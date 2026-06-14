//! Local application store (SQLite via rusqlite).
//!
//! Holds everything that is *about* the app rather than a user's data: saved connections and their
//! folders, query history, saved queries, and settings. Passwords are never written here — they go
//! to the OS keychain, keyed by connection id (see [`Store::secret_set`]).

use std::path::Path;

use chrono::Utc;
use parking_lot::Mutex;
use rusqlite::{params, Connection as Sqlite, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::{AppError, AppResult};
use crate::models::{Connection, ConnectionConfig, ConnectionFolder};

const KEYCHAIN_SERVICE: &str = "dev.swyftgrid.app";

pub struct Store {
    db: Mutex<Sqlite>,
}

impl Store {
    /// Open (creating if necessary) and migrate the store at `path`.
    pub fn open(path: &Path) -> AppResult<Self> {
        let db = Sqlite::open(path)?;
        db.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;
             CREATE TABLE IF NOT EXISTS connection_folders (
                 id TEXT PRIMARY KEY, name TEXT NOT NULL, parent_id TEXT, sort_order INTEGER NOT NULL DEFAULT 0
             );
             CREATE TABLE IF NOT EXISTS connections (
                 id TEXT PRIMARY KEY, name TEXT NOT NULL, config_json TEXT NOT NULL,
                 environment TEXT NOT NULL DEFAULT 'development', folder_id TEXT, color TEXT,
                 is_favorite INTEGER NOT NULL DEFAULT 0,
                 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_connected_at TEXT
             );
             CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS query_history (
                 id TEXT PRIMARY KEY, connection_id TEXT NOT NULL, sql TEXT NOT NULL,
                 execution_ms REAL, rows_affected INTEGER, success INTEGER NOT NULL,
                 error_message TEXT, is_favorite INTEGER NOT NULL DEFAULT 0, executed_at TEXT NOT NULL
             );
             CREATE INDEX IF NOT EXISTS idx_history_conn ON query_history(connection_id, executed_at DESC);
             CREATE TABLE IF NOT EXISTS saved_query_folders (
                 id TEXT PRIMARY KEY, connection_id TEXT NOT NULL, name TEXT NOT NULL,
                 parent_id TEXT, sort_order INTEGER NOT NULL DEFAULT 0
             );
             CREATE TABLE IF NOT EXISTS saved_queries (
                 id TEXT PRIMARY KEY, connection_id TEXT NOT NULL, name TEXT NOT NULL, sql TEXT NOT NULL,
                 description TEXT, folder_id TEXT, tags_json TEXT NOT NULL DEFAULT '[]',
                 is_favorite INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
             );
             CREATE TABLE IF NOT EXISTS dashboards (
                 id TEXT PRIMARY KEY, connection_id TEXT NOT NULL, data TEXT NOT NULL,
                 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
             );
             CREATE INDEX IF NOT EXISTS idx_dashboards_conn ON dashboards(connection_id, updated_at DESC);",
        )?;
        Ok(Self { db: Mutex::new(db) })
    }

    // ── Dashboards (the full dashboard object is stored as JSON in `data`) ────────

    pub fn list_dashboards(&self, connection_id: &str) -> AppResult<Vec<Value>> {
        let db = self.db.lock();
        let mut stmt = db.prepare(
            "SELECT data FROM dashboards WHERE connection_id = ?1 ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map([connection_id], |row| row.get::<_, String>(0))?;
        let mut out = Vec::new();
        for raw in rows {
            if let Ok(value) = serde_json::from_str::<Value>(&raw?) {
                out.push(value);
            }
        }
        Ok(out)
    }

    // ── Connections ────────────────────────────────────────────────────────────

    /// Return all connections (passwords omitted) and folders.
    pub fn list_connections(&self) -> AppResult<(Vec<Connection>, Vec<ConnectionFolder>)> {
        let db = self.db.lock();

        let mut stmt = db.prepare(
            "SELECT id, name, config_json, environment, folder_id, color, is_favorite,
                    created_at, updated_at, last_connected_at FROM connections ORDER BY name",
        )?;
        let connections = stmt
            .query_map([], |row| {
                let config_json: String = row.get(2)?;
                let mut config: ConnectionConfig =
                    serde_json::from_str(&config_json).unwrap_or_else(|_| empty_config());
                config.password = None; // never leak secrets to the list
                clear_ssh_secrets(&mut config);
                Ok(Connection {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    config,
                    environment: row.get(3)?,
                    folder_id: row.get(4)?,
                    color: row.get(5)?,
                    is_favorite: row.get::<_, i64>(6)? != 0,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                    last_connected_at: row.get(9)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let mut fstmt =
            db.prepare("SELECT id, name, parent_id, sort_order FROM connection_folders ORDER BY sort_order, name")?;
        let folders = fstmt
            .query_map([], |row| {
                Ok(ConnectionFolder {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    parent_id: row.get(2)?,
                    sort_order: row.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok((connections, folders))
    }

    /// Resolve a single connection *with* its password (from the keychain) for opening a session.
    pub fn connection_with_secret(&self, id: &str) -> AppResult<Connection> {
        let db = self.db.lock();
        let mut conn = db
            .query_row(
                "SELECT id, name, config_json, environment, folder_id, color, is_favorite,
                        created_at, updated_at, last_connected_at FROM connections WHERE id = ?1",
                params![id],
                |row| {
                    let config_json: String = row.get(2)?;
                    let config: ConnectionConfig =
                        serde_json::from_str(&config_json).unwrap_or_else(|_| empty_config());
                    Ok(Connection {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        config,
                        environment: row.get(3)?,
                        folder_id: row.get(4)?,
                        color: row.get(5)?,
                        is_favorite: row.get::<_, i64>(6)? != 0,
                        created_at: row.get(7)?,
                        updated_at: row.get(8)?,
                        last_connected_at: row.get(9)?,
                    })
                },
            )
            .optional()?
            .ok_or_else(|| AppError::UnknownConnection(id.to_string()))?;
        conn.config.password = self.secret_get(id);
        if conn.config.ssh.is_some() {
            apply_ssh_secrets(&mut conn.config, &self.ssh_secret_get(id));
        }
        Ok(conn)
    }

    /// Upsert a connection. The password (if present) is moved to the keychain.
    pub fn save_connection(&self, mut conn: Connection) -> AppResult<Connection> {
        let now = Utc::now().to_rfc3339();
        if conn.id.is_empty() {
            conn.id = format!("conn_{}", uuid::Uuid::new_v4());
            conn.created_at = now.clone();
        }
        conn.updated_at = now;

        // Split the password out to the keychain.
        if let Some(pw) = conn.config.password.take() {
            if pw.is_empty() {
                self.secret_delete(&conn.id);
            } else {
                self.secret_set(&conn.id, &pw)?;
            }
        }

        // Split SSH secrets out to a separate keychain entry, merging with any stored values so an
        // edit that leaves secret fields blank keeps the existing credentials.
        if conn.config.ssh.is_some() {
            let incoming = take_ssh_secrets(&mut conn.config);
            let merged = merge_ssh_secrets(incoming, self.ssh_secret_get(&conn.id));
            if merged.iter().all(HopSecret::is_empty) {
                self.ssh_secret_delete(&conn.id);
            } else {
                self.ssh_secret_set(&conn.id, &merged)?;
            }
        } else {
            self.ssh_secret_delete(&conn.id);
        }

        let config_json = serde_json::to_string(&conn.config)?;
        let db = self.db.lock();
        db.execute(
            "INSERT INTO connections (id, name, config_json, environment, folder_id, color,
                 is_favorite, created_at, updated_at, last_connected_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
             ON CONFLICT(id) DO UPDATE SET name=?2, config_json=?3, environment=?4, folder_id=?5,
                 color=?6, is_favorite=?7, updated_at=?9",
            params![
                conn.id,
                conn.name,
                config_json,
                conn.environment,
                conn.folder_id,
                conn.color,
                conn.is_favorite as i64,
                conn.created_at,
                conn.updated_at,
                conn.last_connected_at,
            ],
        )?;
        drop(db);
        // Reload without the secret so the UI shape is consistent.
        let mut saved = conn;
        saved.config.password = None;
        Ok(saved)
    }

    pub fn delete_connection(&self, id: &str) -> AppResult<()> {
        self.secret_delete(id);
        self.ssh_secret_delete(id);
        let db = self.db.lock();
        db.execute("DELETE FROM connections WHERE id = ?1", params![id])?;
        db.execute(
            "DELETE FROM query_history WHERE connection_id = ?1",
            params![id],
        )?;
        db.execute(
            "DELETE FROM saved_queries WHERE connection_id = ?1",
            params![id],
        )?;
        Ok(())
    }

    pub fn touch_connection(&self, id: &str) -> AppResult<()> {
        let db = self.db.lock();
        db.execute(
            "UPDATE connections SET last_connected_at = ?2 WHERE id = ?1",
            params![id, Utc::now().to_rfc3339()],
        )?;
        Ok(())
    }

    pub fn save_folder(&self, mut folder: ConnectionFolder) -> AppResult<ConnectionFolder> {
        if folder.id.is_empty() {
            folder.id = format!("folder_{}", uuid::Uuid::new_v4());
        }
        let db = self.db.lock();
        db.execute(
            "INSERT INTO connection_folders (id, name, parent_id, sort_order) VALUES (?1,?2,?3,?4)
             ON CONFLICT(id) DO UPDATE SET name=?2, parent_id=?3, sort_order=?4",
            params![folder.id, folder.name, folder.parent_id, folder.sort_order],
        )?;
        Ok(folder)
    }

    pub fn delete_folder(&self, id: &str) -> AppResult<()> {
        let db = self.db.lock();
        db.execute(
            "UPDATE connections SET folder_id = NULL WHERE folder_id = ?1",
            params![id],
        )?;
        db.execute("DELETE FROM connection_folders WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ── Settings (opaque JSON owned by the frontend types) ───────────────────────

    pub fn get_settings(&self) -> AppResult<Option<Value>> {
        let db = self.db.lock();
        let raw: Option<String> = db
            .query_row("SELECT data FROM settings WHERE id = 1", [], |r| r.get(0))
            .optional()?;
        Ok(raw.and_then(|s| serde_json::from_str(&s).ok()))
    }

    pub fn set_settings(&self, value: &Value) -> AppResult<()> {
        let db = self.db.lock();
        db.execute(
            "INSERT INTO settings (id, data) VALUES (1, ?1)
             ON CONFLICT(id) DO UPDATE SET data = ?1",
            params![serde_json::to_string(value)?],
        )?;
        Ok(())
    }

    // ── Generic JSON tables used by history + saved queries ──────────────────────

    /// Run a query returning rows as JSON objects. Keeps the history/saved-query command code terse.
    pub fn query_json(&self, sql: &str, bind: &[&dyn rusqlite::ToSql]) -> AppResult<Vec<Value>> {
        let db = self.db.lock();
        let mut stmt = db.prepare(sql)?;
        let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
        let rows = stmt.query_map(bind, |row| {
            let mut obj = serde_json::Map::new();
            for (i, name) in col_names.iter().enumerate() {
                obj.insert(name.clone(), sqlite_value_to_json(row, i));
            }
            Ok(Value::Object(obj))
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn execute(&self, sql: &str, bind: &[&dyn rusqlite::ToSql]) -> AppResult<()> {
        let db = self.db.lock();
        db.execute(sql, bind)?;
        Ok(())
    }

    // ── Keychain ─────────────────────────────────────────────────────────────────

    fn secret_set(&self, id: &str, password: &str) -> AppResult<()> {
        keyring::Entry::new(KEYCHAIN_SERVICE, id)?.set_password(password)?;
        Ok(())
    }

    fn secret_get(&self, id: &str) -> Option<String> {
        keyring::Entry::new(KEYCHAIN_SERVICE, id)
            .ok()
            .and_then(|e| e.get_password().ok())
    }

    fn secret_delete(&self, id: &str) {
        if let Ok(entry) = keyring::Entry::new(KEYCHAIN_SERVICE, id) {
            let _ = entry.delete_credential();
        }
    }

    fn ssh_account(id: &str) -> String {
        format!("{id}/ssh")
    }

    fn ssh_secret_set(&self, id: &str, secrets: &[HopSecret]) -> AppResult<()> {
        let json = serde_json::to_string(secrets)?;
        keyring::Entry::new(KEYCHAIN_SERVICE, &Self::ssh_account(id))?.set_password(&json)?;
        Ok(())
    }

    fn ssh_secret_get(&self, id: &str) -> Vec<HopSecret> {
        keyring::Entry::new(KEYCHAIN_SERVICE, &Self::ssh_account(id))
            .ok()
            .and_then(|e| e.get_password().ok())
            .and_then(|json| serde_json::from_str(&json).ok())
            .unwrap_or_default()
    }

    fn ssh_secret_delete(&self, id: &str) {
        if let Ok(entry) = keyring::Entry::new(KEYCHAIN_SERVICE, &Self::ssh_account(id)) {
            let _ = entry.delete_credential();
        }
    }
}

fn empty_config() -> ConnectionConfig {
    ConnectionConfig {
        host: "localhost".into(),
        port: 5432,
        database: "postgres".into(),
        username: "postgres".into(),
        password: None,
        ssl: crate::models::SslOptions {
            mode: "prefer".into(),
            root_cert: None,
            client_cert: None,
            client_key: None,
        },
        connection_string: None,
        connect_timeout_secs: None,
        method: None,
        ssh: None,
    }
}

// ── SSH secret handling ──────────────────────────────────────────────────────
//
// SSH hop secrets are treated exactly like the database password: never written to the SQLite
// `config_json`, never returned in listings, and held in the OS keychain under a separate
// `"{id}/ssh"` account.

/// The per-hop secrets pulled out of an SSH config before persistence.
#[derive(Default, Serialize, Deserialize)]
struct HopSecret {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    password: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    private_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    passphrase: Option<String>,
}

impl HopSecret {
    fn is_empty(&self) -> bool {
        self.password.is_none() && self.private_key.is_none() && self.passphrase.is_none()
    }
}

/// Null every SSH secret field on a config in place (used for listings and before persisting).
fn clear_ssh_secrets(config: &mut ConnectionConfig) {
    if let Some(ssh) = config.ssh.as_mut() {
        for hop in &mut ssh.hops {
            hop.password = None;
            hop.private_key = None;
            hop.passphrase = None;
        }
    }
}

/// Take the SSH secrets out of a config (clearing them in place), one entry per hop.
fn take_ssh_secrets(config: &mut ConnectionConfig) -> Vec<HopSecret> {
    let Some(ssh) = config.ssh.as_mut() else {
        return Vec::new();
    };
    ssh.hops
        .iter_mut()
        .map(|hop| HopSecret {
            password: hop.password.take(),
            private_key: hop.private_key.take(),
            passphrase: hop.passphrase.take(),
        })
        .collect()
}

/// Re-apply stored SSH secrets to a config's hops (by position).
fn apply_ssh_secrets(config: &mut ConnectionConfig, secrets: &[HopSecret]) {
    if let Some(ssh) = config.ssh.as_mut() {
        for (hop, secret) in ssh.hops.iter_mut().zip(secrets) {
            hop.password = secret.password.clone();
            hop.private_key = secret.private_key.clone();
            hop.passphrase = secret.passphrase.clone();
        }
    }
}

/// Choose between a freshly-submitted secret and the stored one: a non-empty submission wins, an
/// explicit empty string clears it, and an omitted (None) field keeps what was stored.
fn pick_secret(incoming: Option<String>, existing: Option<String>) -> Option<String> {
    match incoming {
        Some(s) if !s.is_empty() => Some(s),
        Some(_) => None,
        None => existing,
    }
}

fn merge_ssh_secrets(incoming: Vec<HopSecret>, existing: Vec<HopSecret>) -> Vec<HopSecret> {
    incoming
        .into_iter()
        .enumerate()
        .map(|(i, inc)| {
            let ex = existing.get(i);
            HopSecret {
                password: pick_secret(inc.password, ex.and_then(|e| e.password.clone())),
                private_key: pick_secret(inc.private_key, ex.and_then(|e| e.private_key.clone())),
                passphrase: pick_secret(inc.passphrase, ex.and_then(|e| e.passphrase.clone())),
            }
        })
        .collect()
}

fn sqlite_value_to_json(row: &rusqlite::Row, idx: usize) -> Value {
    use rusqlite::types::ValueRef;
    match row.get_ref(idx) {
        Ok(ValueRef::Null) => Value::Null,
        Ok(ValueRef::Integer(i)) => Value::Number(i.into()),
        Ok(ValueRef::Real(f)) => serde_json::Number::from_f64(f)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        Ok(ValueRef::Text(t)) => Value::String(String::from_utf8_lossy(t).into_owned()),
        Ok(ValueRef::Blob(b)) => Value::String(format!(
            "\\x{}",
            b.iter().map(|x| format!("{x:02x}")).collect::<String>()
        )),
        Err(_) => Value::Null,
    }
}

//! Session manager.
//!
//! Holds one live `tokio_postgres::Client` per connected database, keyed by connection id. Opening a
//! session negotiates TLS based on the connection's `sslmode`, spawns the driver's background task,
//! and records the server version for the dashboard.

use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use dashmap::DashMap;
use tokio::io::{AsyncRead, AsyncWrite};
use tokio_postgres::config::{Host, SslMode};
use tokio_postgres::tls::MakeTlsConnect;
use tokio_postgres::{Client, Config, NoTls};

use crate::error::{AppError, AppResult};
use crate::models::ConnectionConfig;

/// Outcome of a connectivity test, including any SSH host-key fingerprints worth pinning.
pub struct TestReport {
    pub latency_ms: u64,
    pub server_version: String,
    pub ssh_host_fingerprints: Vec<String>,
}

pub struct Session {
    pub client: Arc<Client>,
    pub server_version: String,
    pub last_connected_at: String,
    /// Host-key fingerprints observed while building the SSH tunnel (empty for direct connections).
    pub ssh_host_fingerprints: Vec<String>,
}

#[derive(Default)]
pub struct Pool {
    sessions: DashMap<String, Arc<Session>>,
}

impl Pool {
    pub fn new() -> Self {
        Self::default()
    }

    /// Return the live session for `connection_id`, or an error instructing the caller to connect.
    pub fn get(&self, connection_id: &str) -> AppResult<Arc<Session>> {
        self.sessions
            .get(connection_id)
            .map(|s| s.clone())
            .ok_or_else(|| AppError::NotConnected(connection_id.to_string()))
    }

    pub fn remove(&self, connection_id: &str) {
        self.sessions.remove(connection_id);
    }

    pub fn is_connected(&self, connection_id: &str) -> bool {
        self.sessions.contains_key(connection_id)
    }

    /// Open (or replace) a session for `connection_id` using `config`.
    pub async fn open(
        &self,
        connection_id: &str,
        config: &ConnectionConfig,
    ) -> AppResult<Arc<Session>> {
        let session = connect(config).await?;
        let session = Arc::new(session);
        self.sessions
            .insert(connection_id.to_string(), session.clone());
        Ok(session)
    }
}

/// Build a `tokio_postgres::Config` from our model, honouring an explicit connection string.
fn build_config(c: &ConnectionConfig) -> AppResult<Config> {
    let mut config =
        if let Some(conn_str) = c.connection_string.as_deref().filter(|s| !s.is_empty()) {
            conn_str
                .parse::<Config>()
                .map_err(|e| AppError::InvalidConfig(e.to_string()))?
        } else {
            let mut cfg = Config::new();
            cfg.host(&c.host)
                .port(c.port)
                .dbname(&c.database)
                .user(&c.username)
                .application_name("Swyftgrids");
            if let Some(pw) = &c.password {
                cfg.password(pw);
            }
            cfg
        };

    config.connect_timeout(Duration::from_secs(c.connect_timeout_secs.unwrap_or(15)));
    config.ssl_mode(match c.ssl.mode.as_str() {
        "disable" => SslMode::Disable,
        "require" | "verify-ca" | "verify-full" => SslMode::Require,
        _ => SslMode::Prefer,
    });
    Ok(config)
}

/// Connect and resolve the server version. Spawns the connection's background task. When the config
/// uses an SSH tunnel the Postgres protocol runs over a forwarded channel (`connect_raw`); otherwise
/// it connects directly.
pub async fn connect(c: &ConnectionConfig) -> AppResult<Session> {
    let config = build_config(c)?;
    let use_tls = !matches!(c.ssl.mode.as_str(), "disable");

    let (client, fingerprints) = if c.uses_ssh() {
        let ssh = c.ssh.as_ref().expect("uses_ssh checked ssh is present");
        // The database endpoint as seen from the final hop. Derived from the parsed config so it
        // works whether the user used discrete fields or a connection string.
        let (db_host, db_port) = db_endpoint(c, &config);
        let tunnel = crate::db::tunnel::open(ssh, &db_host, db_port).await?;
        let client = open_raw(&config, tunnel.stream, &db_host, use_tls, tunnel.handles).await?;
        (client, tunnel.fingerprints)
    } else {
        let client = if use_tls {
            spawn_connect(config.connect(make_tls()).await?)
        } else {
            spawn_connect(config.connect(NoTls).await?)
        };
        (client, Vec::new())
    };

    let server_version: String = client
        .query_one("SELECT version()", &[])
        .await
        .ok()
        .and_then(|row| row.try_get::<_, String>(0).ok())
        .unwrap_or_else(|| "PostgreSQL".to_string());

    Ok(Session {
        client: Arc::new(client),
        server_version,
        last_connected_at: Utc::now().to_rfc3339(),
        ssh_host_fingerprints: fingerprints,
    })
}

/// Spawn the driver background task for a direct connection and return the client.
fn spawn_connect<T>(pair: (Client, T)) -> Client
where
    T: std::future::Future<Output = Result<(), tokio_postgres::Error>> + Send + 'static,
{
    let (client, connection) = pair;
    tauri::async_runtime::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("[swyftgrid] postgres connection error: {e}");
        }
    });
    client
}

/// Run Postgres over an already-established stream (an SSH `direct-tcpip` channel), spawning the
/// driver task and keeping the SSH `handles` alive for the lifetime of the connection.
async fn open_raw<S>(
    config: &Config,
    stream: S,
    db_host: &str,
    use_tls: bool,
    handles: Vec<russh::client::Handle<crate::db::tunnel::Client>>,
) -> AppResult<Client>
where
    S: AsyncRead + AsyncWrite + Unpin + Send + 'static,
{
    if use_tls {
        let mut maker = make_tls();
        let tls = <_ as MakeTlsConnect<S>>::make_tls_connect(&mut maker, db_host)
            .map_err(|e| AppError::InvalidConfig(format!("TLS setup: {e}")))?;
        let (client, connection) = config.connect_raw(stream, tls).await?;
        tauri::async_runtime::spawn(async move {
            let _handles = handles; // hold the tunnel open until the connection ends
            if let Err(e) = connection.await {
                eprintln!("[swyftgrid] postgres connection error: {e}");
            }
        });
        Ok(client)
    } else {
        let (client, connection) = config.connect_raw(stream, NoTls).await?;
        tauri::async_runtime::spawn(async move {
            let _handles = handles;
            if let Err(e) = connection.await {
                eprintln!("[swyftgrid] postgres connection error: {e}");
            }
        });
        Ok(client)
    }
}

/// The database host/port to forward to, read from the parsed config (covers connection strings).
fn db_endpoint(c: &ConnectionConfig, config: &Config) -> (String, u16) {
    let host = match config.get_hosts().first() {
        Some(Host::Tcp(h)) => h.clone(),
        _ => c.host.clone(),
    };
    let port = config.get_ports().first().copied().unwrap_or(c.port);
    (host, port)
}

/// Run a lightweight connectivity test, returning latency, server version, and SSH fingerprints.
pub async fn test(c: &ConnectionConfig) -> AppResult<TestReport> {
    let started = std::time::Instant::now();
    let session = connect(c).await?;
    let latency_ms = started.elapsed().as_millis() as u64;
    Ok(TestReport {
        latency_ms,
        server_version: session.server_version,
        ssh_host_fingerprints: session.ssh_host_fingerprints,
    })
}

/// Build a rustls-backed TLS connector trusting the Mozilla webpki root set.
fn make_tls() -> tokio_postgres_rustls::MakeRustlsConnect {
    let mut roots = rustls::RootCertStore::empty();
    roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
    let config = rustls::ClientConfig::builder()
        .with_root_certificates(roots)
        .with_no_client_auth();
    tokio_postgres_rustls::MakeRustlsConnect::new(config)
}

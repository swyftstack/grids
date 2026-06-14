//! Unified error type. All Tauri commands return `Result<T, AppError>`; `AppError` serialises to a
//! plain object the frontend can render (message + optional SQLSTATE/detail/hint).

use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("database error: {0}")]
    Postgres(#[from] tokio_postgres::Error),

    #[error("local store error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("keychain error: {0}")]
    Keyring(#[from] keyring::Error),

    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("csv error: {0}")]
    Csv(#[from] csv::Error),

    #[error("no active connection for id `{0}` — call db.connect first")]
    NotConnected(String),

    #[error("connection `{0}` not found")]
    UnknownConnection(String),

    #[error("invalid connection config: {0}")]
    InvalidConfig(String),

    #[error("{0}")]
    Other(String),
}

/// JSON shape sent to the UI. Mirrors `QueryError` in `@swyftgrid/core`.
#[derive(Debug, Serialize)]
pub struct SerializedError {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        // Pull structured fields out of a PostgreSQL error when we have one.
        let serialized = if let AppError::Postgres(pg) = self {
            if let Some(db) = pg.as_db_error() {
                SerializedError {
                    message: db.message().to_string(),
                    code: Some(db.code().code().to_string()),
                    detail: db.detail().map(str::to_string),
                    hint: db.hint().map(str::to_string),
                }
            } else {
                SerializedError {
                    message: self.to_string(),
                    code: None,
                    detail: None,
                    hint: None,
                }
            }
        } else {
            SerializedError {
                message: self.to_string(),
                code: None,
                detail: None,
                hint: None,
            }
        };
        serialized.serialize(serializer)
    }
}

impl AppError {
    /// Build the structured payload sent to the UI, extracting SQLSTATE/detail/hint from a
    /// PostgreSQL error when present.
    pub fn serialized(&self) -> SerializedError {
        if let AppError::Postgres(pg) = self {
            if let Some(db) = pg.as_db_error() {
                return SerializedError {
                    message: db.message().to_string(),
                    code: Some(db.code().code().to_string()),
                    detail: db.detail().map(str::to_string),
                    hint: db.hint().map(str::to_string),
                };
            }
        }
        SerializedError {
            message: self.to_string(),
            code: None,
            detail: None,
            hint: None,
        }
    }
}

pub type AppResult<T> = Result<T, AppError>;

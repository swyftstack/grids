//! SSH tunnelling for `ssh-tunnel`, `bastion`, and `jump-host` connections.
//!
//! Builds an ordered chain of SSH hops with the pure-Rust [`russh`] client and opens a
//! `direct-tcpip` channel from the final hop to the database. The returned [`Tunnel`] hands back an
//! async stream that [`crate::db::pool`] feeds straight into `tokio_postgres::Config::connect_raw`,
//! plus the live SSH handles (which must be kept alive for as long as the database connection) and
//! the observed host-key fingerprints.
//!
//! Host keys are verified: when a hop pins a `host_fingerprint` a mismatch is refused; otherwise the
//! key is trusted on first use and its fingerprint is surfaced so the user can pin it.

use std::sync::Arc;

use parking_lot::Mutex;
use russh::client::{self, Handle};
use russh_keys::key::PublicKey;
use tokio::io::{AsyncRead, AsyncWrite};

use crate::error::{AppError, AppResult};
use crate::models::{SshConfig, SshHostConfig};

/// The stream type carried over an SSH `direct-tcpip` channel.
pub type TunnelStream = russh::ChannelStream<russh::client::Msg>;

/// A live SSH tunnel. `stream` reaches the database; `_handles` keep every hop alive and must not be
/// dropped before the database connection ends.
pub struct Tunnel {
    pub stream: TunnelStream,
    pub handles: Vec<Handle<Client>>,
    /// Observed host-key fingerprints (one per hop, in order) for hops that were not already pinned.
    pub fingerprints: Vec<String>,
}

/// russh client handler. Records the server key fingerprint and enforces pinning.
pub struct Client {
    /// Expected `SHA256:...` fingerprint, when the hop pins one.
    pinned: Option<String>,
    /// Where the observed fingerprint is recorded so the caller can read it after connecting.
    observed: Arc<Mutex<Option<String>>>,
}

#[async_trait::async_trait]
impl client::Handler for Client {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        let fingerprint = format!("SHA256:{}", server_public_key.fingerprint());
        *self.observed.lock() = Some(fingerprint.clone());
        match &self.pinned {
            // A pinned fingerprint that does not match is a hard failure (possible MITM).
            Some(expected) => Ok(expected == &fingerprint),
            // Trust on first use; the caller surfaces the fingerprint so it can be pinned.
            None => Ok(true),
        }
    }
}

/// Open a tunnel to `db_host:db_port` through the hop chain in `ssh`.
pub async fn open(ssh: &SshConfig, db_host: &str, db_port: u16) -> AppResult<Tunnel> {
    if ssh.hops.is_empty() {
        return Err(AppError::InvalidConfig(
            "SSH tunnel has no hops configured".into(),
        ));
    }

    let config = Arc::new(client::Config::default());
    let mut handles: Vec<Handle<Client>> = Vec::with_capacity(ssh.hops.len());
    let mut fingerprints: Vec<String> = Vec::with_capacity(ssh.hops.len());

    for (i, hop) in ssh.hops.iter().enumerate() {
        let observed = Arc::new(Mutex::new(None));
        let handler = Client {
            pinned: hop.host_fingerprint.clone(),
            observed: observed.clone(),
        };

        let mut handle = if i == 0 {
            // First hop: connect over a fresh TCP socket.
            client::connect(config.clone(), (hop.host.as_str(), hop.port), handler)
                .await
                .map_err(|e| ssh_err(hop, e))?
        } else {
            // Subsequent hop: tunnel through the previous hop with a direct-tcpip channel.
            let prev = handles.last().expect("previous hop exists");
            let channel = prev
                .channel_open_direct_tcpip(hop.host.clone(), hop.port as u32, "127.0.0.1", 0)
                .await
                .map_err(|e| ssh_err(hop, e))?;
            client::connect_stream(config.clone(), channel.into_stream(), handler)
                .await
                .map_err(|e| ssh_err(hop, e))?
        };

        authenticate(&mut handle, hop).await?;

        if hop.host_fingerprint.is_none() {
            if let Some(fp) = observed.lock().take() {
                fingerprints.push(fp);
            }
        }
        handles.push(handle);
    }

    // Final hop -> database.
    let last = handles.last().expect("at least one hop");
    let channel = last
        .channel_open_direct_tcpip(db_host.to_string(), db_port as u32, "127.0.0.1", 0)
        .await
        .map_err(|e| AppError::Other(format!("SSH forward to {db_host}:{db_port} failed: {e}")))?;

    Ok(Tunnel {
        stream: channel.into_stream(),
        handles,
        fingerprints,
    })
}

/// Authenticate one hop with a password or private key.
async fn authenticate(handle: &mut Handle<Client>, hop: &SshHostConfig) -> AppResult<()> {
    let authed = match hop.auth.as_str() {
        "password" => {
            let pw = hop.password.clone().unwrap_or_default();
            handle
                .authenticate_password(&hop.username, pw)
                .await
                .map_err(|e| ssh_err(hop, e))?
        }
        _ => {
            // Default to key auth. Accept either an inline PEM or a path on disk.
            let key = load_key(hop)?;
            handle
                .authenticate_publickey(&hop.username, Arc::new(key))
                .await
                .map_err(|e| ssh_err(hop, e))?
        }
    };
    if !authed {
        return Err(AppError::Other(format!(
            "SSH authentication failed for {}@{}",
            hop.username, hop.host
        )));
    }
    Ok(())
}

/// Load the private key for a hop from an inline PEM or a key file, decrypting with the passphrase.
fn load_key(hop: &SshHostConfig) -> AppResult<russh_keys::key::KeyPair> {
    let passphrase = hop.passphrase.as_deref().filter(|s| !s.is_empty());
    if let Some(pem) = hop.private_key.as_deref().filter(|s| !s.is_empty()) {
        russh_keys::decode_secret_key(pem, passphrase)
            .map_err(|e| AppError::InvalidConfig(format!("SSH private key for {}: {e}", hop.host)))
    } else if let Some(path) = hop.private_key_path.as_deref().filter(|s| !s.is_empty()) {
        russh_keys::load_secret_key(path, passphrase)
            .map_err(|e| AppError::InvalidConfig(format!("SSH key file {path}: {e}")))
    } else {
        Err(AppError::InvalidConfig(format!(
            "SSH hop {} uses key auth but no key was provided",
            hop.host
        )))
    }
}

fn ssh_err(hop: &SshHostConfig, e: russh::Error) -> AppError {
    AppError::Other(format!("SSH error at {}:{}: {e}", hop.host, hop.port))
}

/// Assert at compile time that the tunnel stream satisfies `connect_raw`'s bounds.
fn _assert_stream_bounds<S: AsyncRead + AsyncWrite + Unpin + Send + 'static>() {}
const _: fn() = || _assert_stream_bounds::<TunnelStream>();

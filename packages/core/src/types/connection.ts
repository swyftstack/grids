/**
 * Connection types.
 *
 * A {@link Connection} describes how to reach a PostgreSQL server. Connections are stored in the
 * local SQLite application store — never on a remote server — and are the unit users organise into
 * folders and favourites.
 */

/** SSL negotiation mode, mirroring libpq's `sslmode`. */
export type SslMode = 'disable' | 'allow' | 'prefer' | 'require' | 'verify-ca' | 'verify-full';

/**
 * How Swyftgrids reaches the database host.
 *
 * - `direct` — a plain TCP connection to the database.
 * - `ssh-tunnel` — forward through a single SSH server that can reach the database.
 * - `bastion` — forward through a single hardened gateway (bastion) host. Mechanically the same as
 *   `ssh-tunnel`; kept distinct so the form and saved metadata reflect the user's intent.
 * - `jump-host` — chain through one or more intermediate SSH hosts (ProxyJump) before the final hop
 *   that reaches the database.
 *
 * Under the hood every non-direct method is an ordered chain of {@link SshHostConfig} hops:
 * `ssh-tunnel`/`bastion` use one hop, `jump-host` uses two or more.
 */
export type ConnectionMethod = 'direct' | 'ssh-tunnel' | 'bastion' | 'jump-host';

/** How to authenticate to an SSH hop. (`agent` is a planned addition.) */
export type SshAuthMethod = 'password' | 'key';

/**
 * A single SSH hop. Secrets (`password`, `privateKey`, `passphrase`) are treated exactly like the
 * database password: kept out of the metadata store and held in the OS keychain on the desktop, and
 * never returned in connection listings.
 */
export interface SshHostConfig {
  host: string;
  /** SSH port. Defaults to 22. */
  port: number;
  username: string;
  auth: SshAuthMethod;
  /** SECRET. Used when `auth` is `password`. */
  password?: string;
  /** Path to a private key file on disk. Not a secret. Used when `auth` is `key`. */
  privateKeyPath?: string;
  /** SECRET. Inline PEM private key. Used when `auth` is `key` and no path is given. */
  privateKey?: string;
  /** SECRET. Passphrase for an encrypted private key. */
  passphrase?: string;
  /**
   * Pinned SSH host key fingerprint (SHA-256, base64, no padding — the `SHA256:...` form). When set,
   * the connection is refused if the server presents a different key. When unset, the key is trusted
   * on first use and its fingerprint is surfaced so it can be pinned.
   */
  hostFingerprint?: string;
}

/** SSH tunnel configuration: an ordered chain of hops from the client to the database host. */
export interface SshConfig {
  /** One hop for `ssh-tunnel`/`bastion`; two or more (jump...→target) for `jump-host`. */
  hops: SshHostConfig[];
}

/**
 * Whether a connection points at an environment that should be treated as dangerous.
 * Drives the Production Safety banner and destructive-query confirmations.
 */
export type ConnectionEnvironment = 'development' | 'staging' | 'production';

export interface SslOptions {
  mode: SslMode;
  /** PEM-encoded CA certificate, or a path to one. Optional. */
  rootCert?: string;
  /** Client certificate for mutual TLS. Optional. */
  clientCert?: string;
  /** Client private key for mutual TLS. Optional. */
  clientKey?: string;
}

/** The connection parameters required to open a session. */
export interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  /**
   * Password. In the desktop app this is kept out of the metadata DB and stored in the OS keychain
   * when possible; see docs/configuration.md#credential-storage.
   */
  password?: string;
  ssl: SslOptions;
  /**
   * Optional raw connection string (e.g. `postgres://user:pass@host:5432/db`). When present it is
   * the source of truth and the discrete fields above are derived from it.
   */
  connectionString?: string;
  /** Connection timeout in seconds. Falls back to the global setting when undefined. */
  connectTimeoutSecs?: number;
  /**
   * How to reach the host. Absent or `direct` means a plain connection; any other value requires
   * {@link ssh}. The host/port above are always the *database* endpoint as seen from the final hop.
   */
  method?: ConnectionMethod;
  /** SSH hop chain, present when {@link method} is not `direct`. */
  ssh?: SshConfig;
}

/** A saved connection plus its organisational metadata. */
export interface Connection {
  id: string;
  name: string;
  config: ConnectionConfig;
  environment: ConnectionEnvironment;
  /** Id of the {@link ConnectionFolder} this connection belongs to, or null for the root. */
  folderId: string | null;
  color?: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  lastConnectedAt?: string;
}

/** A folder used to group connections in the sidebar. */
export interface ConnectionFolder {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

/** Payload for creating or updating a connection (id/timestamps assigned by the store). */
export type ConnectionInput = Omit<
  Connection,
  'id' | 'createdAt' | 'updatedAt' | 'lastConnectedAt'
>;

/** Result of a connection test, used by the "Test connection" button. */
export interface ConnectionTestResult {
  ok: boolean;
  /** Round-trip latency in milliseconds when the test succeeds. */
  latencyMs?: number;
  /** Server version string reported by the server, e.g. "PostgreSQL 16.2". */
  serverVersion?: string;
  /** Human-readable error message when `ok` is false. */
  error?: string;
  /**
   * Observed SSH host key fingerprints (one per hop, in order) for any hop that was not already
   * pinned. The UI can offer to pin these so future connections verify the server identity.
   */
  sshHostFingerprints?: string[];
}

/** A blank SSH hop for the connection form. */
export const defaultSshHostConfig: SshHostConfig = {
  host: '',
  port: 22,
  username: '',
  auth: 'key',
};

/**
 * Sensible defaults for a brand new connection form. Most databases are reached directly, so a new
 * connection starts as `direct` with no SSH config — switching to a tunnelling method in the form
 * adds the SSH hop(s) on demand.
 */
export const defaultConnectionConfig: ConnectionConfig = {
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  username: 'postgres',
  password: '',
  ssl: { mode: 'prefer' },
  method: 'direct',
};

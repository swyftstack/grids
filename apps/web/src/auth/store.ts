/**
 * Local SQLite auth store (built-in `node:sqlite` — no native dependency).
 *
 * Holds the single admin account, active sessions, and a small key/value `meta` table (used for the
 * runtime "auth disabled" flag set by the `disable-auth` CLI command). Only ONE user is ever
 * allowed; attempts to create a second are rejected.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export interface AuthUser {
  id: string;
  email: string;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  must_change_password: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

interface SessionRow {
  id: string;
  user_id: string;
  csrf_token: string;
  created_at: string;
  expires_at: string;
}

export interface SessionInfo {
  id: string;
  csrfToken: string;
  expiresAt: string;
}

const token = (bytes = 32) => randomBytes(bytes).toString('hex');
const toUser = (r: UserRow): AuthUser => ({
  id: r.id,
  email: r.email,
  mustChangePassword: r.must_change_password !== 0,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  lastLoginAt: r.last_login_at,
});

export class AuthStore {
  private db: DatabaseSync;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.db = new DatabaseSync(join(dataDir, 'auth.sqlite'));
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        csrf_token TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
  }

  // ── Users (single admin) ─────────────────────────────────────────────────────

  userCount(): number {
    const row = this.db.prepare('SELECT count(*) AS n FROM users').get() as { n: number };
    return Number(row.n);
  }

  getUser(): AuthUser | null {
    const row = this.db.prepare('SELECT * FROM users LIMIT 1').get() as UserRow | undefined;
    return row ? toUser(row) : null;
  }

  /** Internal: the row including the password hash, for login verification. */
  private getUserRow(): UserRow | null {
    return (this.db.prepare('SELECT * FROM users LIMIT 1').get() as UserRow | undefined) ?? null;
  }

  passwordHash(): string | null {
    return this.getUserRow()?.password_hash ?? null;
  }

  /** Create the admin account. Throws if one already exists (single-user constraint). */
  createUser(email: string, passwordHash: string, mustChange = false): AuthUser {
    if (this.userCount() > 0) {
      throw new Error('An admin account already exists. Only one account is supported.');
    }
    const now = new Date().toISOString();
    const id = `usr_${randomUUID()}`;
    this.db
      .prepare(
        `INSERT INTO users (id, email, password_hash, must_change_password, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, email.trim(), passwordHash, mustChange ? 1 : 0, now, now);
    return this.getUser()!;
  }

  updatePassword(userId: string, passwordHash: string, mustChange: boolean): void {
    this.db
      .prepare(
        `UPDATE users SET password_hash = ?, must_change_password = ?, updated_at = ? WHERE id = ?`,
      )
      .run(passwordHash, mustChange ? 1 : 0, new Date().toISOString(), userId);
  }

  recordLogin(userId: string): void {
    this.db
      .prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
      .run(new Date().toISOString(), userId);
  }

  // ── Sessions ─────────────────────────────────────────────────────────────────

  createSession(userId: string, days: number): SessionInfo {
    const id = token(32);
    const csrf = token(24);
    const now = Date.now();
    const expiresAt = new Date(now + days * 86_400_000).toISOString();
    this.db
      .prepare(
        `INSERT INTO sessions (id, user_id, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, userId, csrf, new Date(now).toISOString(), expiresAt);
    return { id, csrfToken: csrf, expiresAt };
  }

  /** Resolve a session id to its user, or `null` when missing/expired (expired rows are purged). */
  getSession(id: string | undefined): { session: SessionRow; user: AuthUser } | null {
    if (!id) return null;
    const session = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
      | SessionRow
      | undefined;
    if (!session) return null;
    if (new Date(session.expires_at).getTime() < Date.now()) {
      this.deleteSession(id);
      return null;
    }
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as
      | UserRow
      | undefined;
    if (!row) return null;
    return { session, user: toUser(row) };
  }

  deleteSession(id: string): void {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  /** Invalidate every session except `keepId` (used after a password change). */
  deleteOtherSessions(userId: string, keepId: string): void {
    this.db.prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?').run(userId, keepId);
  }

  deleteAllSessions(): void {
    this.db.prepare('DELETE FROM sessions').run();
  }

  pruneExpiredSessions(): void {
    this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  }

  // ── Meta (runtime flags) ─────────────────────────────────────────────────────

  getMeta(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  setMeta(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?`,
      )
      .run(key, value, value);
  }

  close(): void {
    this.db.close();
  }
}

export const META_AUTH_DISABLED = 'auth_disabled';

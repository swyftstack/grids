/**
 * Password hashing (bcrypt) and validation helpers.
 *
 * Plaintext passwords are never stored or logged. Hashes use bcrypt with a cost of 12.
 */
import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_COST = 12;
export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Validate a new password. Returns an error message, or `null` when acceptable. */
export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length === 0) return 'Password is required';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > 200) return 'Password is too long';
  return null;
}

export function validateEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Generate a readable temporary password in `XXXX-XXXX-XXXX` form using an unambiguous alphabet
 * (no 0/O/1/I/L). Used by the `reset-password` CLI command.
 */
export function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const group = () =>
    Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('');
  return `${group()}-${group()}-${group()}`;
}

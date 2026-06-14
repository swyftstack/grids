import { describe, expect, it } from 'vitest';
import { assessDanger, requiresConfirmation, stripSqlComments } from './safety.js';

describe('assessDanger', () => {
  it('marks a plain SELECT as safe', () => {
    expect(assessDanger('SELECT * FROM users').level).toBe('safe');
  });

  it('flags DROP TABLE as destructive', () => {
    const a = assessDanger('DROP TABLE users');
    expect(a.level).toBe('destructive');
    expect(a.reasons).toContain('DROP');
  });

  it('flags TRUNCATE as destructive', () => {
    expect(assessDanger('TRUNCATE orders').level).toBe('destructive');
  });

  it('treats UPDATE with WHERE as caution', () => {
    expect(assessDanger('UPDATE users SET active = false WHERE id = 1').level).toBe('caution');
  });

  it('escalates UPDATE without WHERE to destructive', () => {
    const a = assessDanger('UPDATE users SET active = false');
    expect(a.level).toBe('destructive');
    expect(a.unscopedWrite).toBe(true);
  });

  it('ignores keywords inside comments', () => {
    expect(assessDanger('SELECT 1 -- DROP TABLE users').level).toBe('safe');
  });

  it('ignores keywords inside string literals', () => {
    expect(assessDanger("SELECT 'please do not DROP TABLE'").level).toBe('safe');
  });
});

describe('requiresConfirmation', () => {
  it('always confirms destructive statements', () => {
    expect(requiresConfirmation('DELETE FROM users', false)).toBe(true);
  });

  it('confirms routine writes only on production', () => {
    expect(requiresConfirmation('INSERT INTO users (id) VALUES (1)', false)).toBe(false);
    expect(requiresConfirmation('INSERT INTO users (id) VALUES (1)', true)).toBe(true);
  });
});

describe('stripSqlComments', () => {
  it('removes line and block comments', () => {
    expect(stripSqlComments('SELECT 1 -- c\n/* x */').includes('c')).toBe(false);
  });
});

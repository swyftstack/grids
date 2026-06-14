import { describe, expect, it } from 'vitest';
import { schemaToSql, tableToSql } from './ddl.js';
import type { SchemaSnapshot, TableInfo } from '../types/schema.js';

const users: TableInfo = {
  schema: 'public',
  name: 'users',
  kind: 'table',
  estimatedRows: 10,
  columns: [
    {
      name: 'id',
      dataType: 'int8',
      udtName: 'int8',
      nullable: false,
      defaultValue: "nextval('users_id_seq')",
      isPrimaryKey: true,
      position: 1,
    },
    {
      name: 'org_id',
      dataType: 'int8',
      udtName: 'int8',
      nullable: true,
      defaultValue: null,
      isPrimaryKey: false,
      references: { schema: 'public', table: 'orgs', column: 'id' },
      position: 2,
    },
  ],
  indexes: [],
  constraints: [],
  triggers: [],
};

const snapshot: SchemaSnapshot = {
  schemas: [{ name: 'public', owner: 'postgres', tableCount: 1, viewCount: 0 }],
  tables: [users],
  functions: [],
  extensions: [{ name: 'pgcrypto', version: '1.3', schema: 'public' }],
  capturedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
};

describe('tableToSql', () => {
  it('emits a CREATE TABLE with columns, default, NOT NULL, PK and FK', () => {
    const sql = tableToSql(users);
    expect(sql).toContain('CREATE TABLE "public"."users"');
    expect(sql).toContain('"id" int8 NOT NULL DEFAULT nextval(\'users_id_seq\')');
    expect(sql).toContain('PRIMARY KEY ("id")');
    expect(sql).toContain('FOREIGN KEY ("org_id") REFERENCES "public"."orgs" ("id")');
  });
});

describe('schemaToSql', () => {
  it('includes extensions and every table', () => {
    const sql = schemaToSql(snapshot);
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    expect(sql).toContain('CREATE TABLE "public"."users"');
  });

  it('does not emit CREATE SCHEMA for the public schema', () => {
    expect(schemaToSql(snapshot)).not.toContain('CREATE SCHEMA');
  });
});

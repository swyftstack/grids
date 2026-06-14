/**
 * Schema introspection types.
 *
 * These mirror the structure of a PostgreSQL catalog as surfaced in the Schema Explorer and ER
 * diagram. They are intentionally database-agnostic in shape so that MySQL/MariaDB support can be
 * added later (see docs/architecture.md#future-databases) without changing the UI.
 */

export type DatabaseObjectKind =
  | 'schema'
  | 'table'
  | 'view'
  | 'materialized_view'
  | 'function'
  | 'trigger'
  | 'index'
  | 'constraint'
  | 'extension'
  | 'sequence';

/** A column on a table or view. */
export interface ColumnInfo {
  name: string;
  /** Display data type, e.g. `varchar(255)`, `int4`, `timestamptz`. */
  dataType: string;
  /** Canonical underlying type, e.g. `character varying`. */
  udtName: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  /** Set when this column is a foreign key. */
  references?: ForeignKeyTarget;
  /** Ordinal position (1-based). */
  position: number;
  comment?: string;
}

export interface ForeignKeyTarget {
  schema: string;
  table: string;
  column: string;
}

export interface IndexInfo {
  name: string;
  /** Columns or expressions covered by the index. */
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  method: string; // btree, hash, gin, gist, ...
  definition: string;
}

export interface ConstraintInfo {
  name: string;
  type: 'primary_key' | 'foreign_key' | 'unique' | 'check' | 'exclusion';
  definition: string;
  columns: string[];
}

export interface TriggerInfo {
  name: string;
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
  events: string[]; // INSERT, UPDATE, DELETE, TRUNCATE
  definition: string;
}

export interface TableInfo {
  schema: string;
  name: string;
  kind: 'table' | 'view' | 'materialized_view';
  /** Estimated row count from the planner statistics (cheap; not an exact COUNT). */
  estimatedRows: number;
  /** Total on-disk size in bytes (table + indexes + toast), when available. */
  sizeBytes?: number;
  comment?: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
  triggers: TriggerInfo[];
}

export interface FunctionInfo {
  schema: string;
  name: string;
  /** Argument signature, e.g. `(integer, text)`. */
  arguments: string;
  returnType: string;
  language: string;
  kind: 'function' | 'procedure' | 'aggregate' | 'window';
}

export interface ExtensionInfo {
  name: string;
  version: string;
  schema: string;
}

export interface SchemaInfo {
  name: string;
  owner: string;
  tableCount: number;
  viewCount: number;
}

/**
 * A lightweight, lazily-expandable tree node used to render the Schema Explorer without loading
 * every object's detail up front.
 */
export interface SchemaTreeNode {
  id: string;
  kind: DatabaseObjectKind | 'group';
  label: string;
  /** For `group` nodes, the kind of children, e.g. "Tables", "Views". */
  groupKind?: DatabaseObjectKind;
  schema?: string;
  /** Whether the node can be expanded to reveal children. */
  expandable: boolean;
  /** Children are loaded on demand; undefined means "not yet loaded". */
  children?: SchemaTreeNode[];
}

/** The full, denormalised schema snapshot used by the ER diagram and universal search. */
export interface SchemaSnapshot {
  schemas: SchemaInfo[];
  tables: TableInfo[];
  functions: FunctionInfo[];
  extensions: ExtensionInfo[];
  /** When the snapshot was taken (ISO 8601). */
  capturedAt: string;
}

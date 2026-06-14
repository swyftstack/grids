/**
 * Query execution and table-browsing types.
 */

/** A single result column descriptor. */
export interface FieldInfo {
  name: string;
  /** PostgreSQL type OID. */
  dataTypeId: number;
  /** Human-friendly type name resolved from the OID, e.g. `text`, `int4`. */
  dataTypeName: string;
}

/**
 * A result cell. Values are normalised to JSON-friendly primitives by the backend:
 * numbers and booleans stay native; everything else (timestamps, json, arrays, uuid, bytea) is a
 * string so the grid renders deterministically and copy-as-JSON round-trips.
 */
export type CellValue = string | number | boolean | null;

export type Row = CellValue[];

/** Result of running a statement that returns rows. */
export interface QueryResult {
  fields: FieldInfo[];
  rows: Row[];
  /** Rows affected for INSERT/UPDATE/DELETE; null for pure SELECTs. */
  rowsAffected: number | null;
  /** Server-side execution time in milliseconds. */
  executionMs: number;
  /** The command tag returned by the server, e.g. `SELECT 42`, `UPDATE 3`. */
  commandTag: string;
  /** True when the result was truncated to the requested `maxRows`. */
  truncated: boolean;
}

/** A query may contain several statements; each produces one result (or an error). */
export interface StatementResult {
  sql: string;
  result?: QueryResult;
  error?: QueryError;
}

export interface QueryError {
  message: string;
  /** PostgreSQL SQLSTATE code, e.g. `42P01`. */
  code?: string;
  detail?: string;
  hint?: string;
  /** Character position of the error within the statement (1-based), when provided. */
  position?: number;
}

export interface QueryExecution {
  statements: StatementResult[];
  /** Wall-clock time for the whole batch, including network, in milliseconds. */
  totalMs: number;
}

/** Sorting directive for the table browser. */
export interface SortSpec {
  column: string;
  direction: 'asc' | 'desc';
}

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'is_null'
  | 'is_not_null'
  | 'in';

export interface FilterSpec {
  column: string;
  operator: FilterOperator;
  value?: CellValue | CellValue[];
}

/** Request for a page of rows from a table, built into a parameterised SELECT by the backend. */
export interface TablePageRequest {
  schema: string;
  table: string;
  /** Zero-based page offset. */
  offset: number;
  limit: number;
  sort: SortSpec[];
  filters: FilterSpec[];
  /** Optional free-text search applied across text-like columns. */
  search?: string;
}

export interface TablePage {
  fields: FieldInfo[];
  rows: Row[];
  /** Estimated total row count (planner statistics) for pagination UI. */
  estimatedTotal: number;
  executionMs: number;
}

/** A primary-key-addressed edit to a single row. */
export interface RowEdit {
  schema: string;
  table: string;
  /** Map of pk column -> value identifying the row. */
  primaryKey: Record<string, CellValue>;
  /** Map of column -> new value to set. */
  changes: Record<string, CellValue>;
}

export interface RowInsert {
  schema: string;
  table: string;
  values: Record<string, CellValue>;
}

export interface RowDelete {
  schema: string;
  table: string;
  primaryKey: Record<string, CellValue>;
}

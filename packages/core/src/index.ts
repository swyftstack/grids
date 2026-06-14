/**
 * @swyftgrid/core — shared types, the IPC contract, and SQL helpers.
 *
 * Frontend and both backends import from this single entry point.
 */

// Types
export * from './types/connection.js';
export * from './types/schema.js';
export * from './types/query.js';
export * from './types/settings.js';
export * from './types/workspace.js';
export * from './types/analysis.js';
export * from './types/monitoring.js';
export * from './types/dashboard.js';
export * from './types/ai.js';

// IPC contract
export * from './ipc/contract.js';

// SQL helpers
export * from './sql/safety.js';
export * from './sql/statements.js';
export * from './sql/ddl.js';

// Utilities
export * from './util/id.js';

/** Build/runtime constants. */
export const APP_NAME = 'Swyftgrids';
export const APP_ID = 'dev.swyftgrid.app';
/** PostgreSQL major versions verified against in CI. */
export const SUPPORTED_PG_VERSIONS = [12, 13, 14, 15, 16, 17] as const;

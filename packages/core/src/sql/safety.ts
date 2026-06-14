/**
 * Production Safety helpers.
 *
 * Swyftgrids does not parse SQL into a full AST on the client; instead it uses fast, conservative
 * heuristics to flag statements that could destroy data. The backend is the real guard rail (it can
 * run `EXPLAIN` and inspect row estimates), but these helpers drive the confirmation UI so the user
 * is warned _before_ a dangerous statement leaves the editor.
 */

export type DangerLevel = 'safe' | 'caution' | 'destructive';

export interface DangerAssessment {
  level: DangerLevel;
  /** The specific keywords that triggered the assessment, e.g. `["DROP TABLE"]`. */
  reasons: string[];
  /** True when a `DELETE`/`UPDATE` appears to lack a `WHERE` clause (affects every row). */
  unscopedWrite: boolean;
}

/** Statements that destroy or irreversibly change schema/data. */
const DESTRUCTIVE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  {
    re: /\bdrop\s+(table|schema|database|view|index|function|sequence|type|extension)\b/i,
    label: 'DROP',
  },
  { re: /\btruncate\b/i, label: 'TRUNCATE' },
  { re: /\bdelete\s+from\b/i, label: 'DELETE' },
  { re: /\balter\s+table\b[\s\S]*\bdrop\s+column\b/i, label: 'DROP COLUMN' },
];

/** Statements that modify data but are usually intentional and reversible-ish. */
const CAUTION_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bupdate\s+[\w."]+\s+set\b/i, label: 'UPDATE' },
  { re: /\binsert\s+into\b/i, label: 'INSERT' },
  { re: /\balter\s+table\b/i, label: 'ALTER TABLE' },
  { re: /\bgrant\b|\brevoke\b/i, label: 'GRANT/REVOKE' },
];

/** Strip string/line/block comments so keywords inside them don't trigger false positives. */
export function stripSqlComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''");
}

/** True when a DELETE/UPDATE statement has no WHERE clause (i.e. it touches the whole table). */
function isUnscopedWrite(clean: string): boolean {
  const hasWrite = /\b(delete\s+from|update)\b/i.test(clean);
  if (!hasWrite) return false;
  // A WHERE anywhere after the write keyword is good enough for a heuristic.
  return !/\bwhere\b/i.test(clean);
}

/**
 * Assess a SQL string for destructive potential. Cheap and synchronous — safe to run on every
 * keystroke if needed.
 */
export function assessDanger(sql: string): DangerAssessment {
  const clean = stripSqlComments(sql);
  const reasons: string[] = [];
  let level: DangerLevel = 'safe';

  for (const { re, label } of DESTRUCTIVE_PATTERNS) {
    if (re.test(clean)) {
      reasons.push(label);
      level = 'destructive';
    }
  }

  if (level !== 'destructive') {
    for (const { re, label } of CAUTION_PATTERNS) {
      if (re.test(clean)) {
        reasons.push(label);
        level = 'caution';
      }
    }
  }

  const unscopedWrite = isUnscopedWrite(clean);
  if (unscopedWrite && level === 'caution') {
    // An UPDATE with no WHERE is effectively destructive.
    level = 'destructive';
    reasons.push('no WHERE clause');
  }

  return { level, reasons: dedupe(reasons), unscopedWrite };
}

/** Whether running `sql` should require an explicit confirmation dialog. */
export function requiresConfirmation(sql: string, isProduction: boolean): boolean {
  const { level } = assessDanger(sql);
  if (level === 'destructive') return true;
  // On production, even routine writes get a confirmation.
  return isProduction && level === 'caution';
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

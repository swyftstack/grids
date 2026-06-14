/**
 * Lightweight SQL utilities used across the app: splitting a script into statements and a tiny
 * pretty-printer. These are deliberately simple and dependency-free; the heavy lifting (real
 * formatting/parsing) can be delegated to a worker or the server when needed.
 */

/**
 * Split a SQL script into individual statements on top-level semicolons, respecting single/double
 * quoted strings, dollar-quoted bodies (`$$ ... $$`), and comments. Good enough to run a multi
 * statement editor buffer statement-by-statement.
 */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];
    const next = sql[i + 1];

    // Line comment
    if (ch === '-' && next === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }
    // Block comment
    if (ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }
    // Single or double quoted string
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let j = i + 1;
      while (j < n) {
        if (sql[j] === quote && sql[j + 1] === quote) {
          j += 2; // escaped quote
          continue;
        }
        if (sql[j] === quote) break;
        j++;
      }
      current += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    // Dollar-quoted string: $tag$ ... $tag$
    if (ch === '$') {
      const tagMatch = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
      if (tagMatch) {
        const tag = tagMatch[0];
        const end = sql.indexOf(tag, i + tag.length);
        const stop = end === -1 ? n : end + tag.length;
        current += sql.slice(i, stop);
        i = stop;
        continue;
      }
    }
    // Statement terminator
    if (ch === ';') {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

const KEYWORDS = [
  'SELECT',
  'FROM',
  'WHERE',
  'GROUP BY',
  'ORDER BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'INNER JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'FULL JOIN',
  'JOIN',
  'ON',
  'AND',
  'OR',
  'INSERT INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE FROM',
  'RETURNING',
  'UNION',
];

/**
 * A minimal, opinionated SQL pretty-printer: uppercases keywords and puts major clauses on their
 * own line. Not a full formatter — it never reorders or reparses — but it makes ad-hoc queries
 * readable instantly with zero dependencies.
 */
export function formatSql(sql: string): string {
  let out = sql.replace(/\s+/g, ' ').trim();
  // Uppercase keywords (longest first to avoid partial matches).
  for (const kw of [...KEYWORDS].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\b${kw.replace(/ /g, '\\s+')}\\b`, 'gi');
    out = out.replace(re, kw);
  }
  // Newlines before major clauses.
  const majors = [
    'FROM',
    'WHERE',
    'GROUP BY',
    'ORDER BY',
    'HAVING',
    'LIMIT',
    'OFFSET',
    'INNER JOIN',
    'LEFT JOIN',
    'RIGHT JOIN',
    'FULL JOIN',
    'JOIN',
    'VALUES',
    'SET',
    'RETURNING',
    'UNION',
  ];
  for (const kw of majors) {
    out = out.replace(new RegExp(`\\s+${kw}\\b`, 'g'), `\n${kw}`);
  }
  return out;
}

/** Quote a PostgreSQL identifier, doubling any embedded quotes. */
export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Fully-qualified, safely-quoted `schema.table` reference. */
export function qualified(schema: string, table: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
}

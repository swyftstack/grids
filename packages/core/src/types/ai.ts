/**
 * AI feature definitions and the data-scope model that drives the consent flow.
 *
 * AI is opt-in and bring-your-own-key. The {@link AiContextMode} a user picks determines which
 * features are available, because some features (e.g. answering a business question) require reading
 * row data, while most only need schema metadata.
 */
import type { AiContextMode } from './settings.js';

export type AiFeature =
  | 'nl_to_sql'
  | 'explain_sql'
  | 'optimize_query'
  | 'explain_error'
  | 'schema_understanding'
  | 'data_discovery'
  | 'documentation'
  | 'migration'
  | 'refactor'
  | 'test_data'
  | 'business_question'
  | 'query_review';

export interface AiRunRequest {
  connectionId: string;
  feature: AiFeature;
  /** The user's input (a question, a SQL statement, an error message…). */
  prompt: string;
  /** Optional extra context the UI gathered (selected SQL, error text, etc.). */
  context?: string;
}

export interface AiResult {
  /** Markdown explanation / answer. */
  text: string;
  /** Generated SQL, when the feature produces a statement. */
  sql?: string;
  /** Non-blocking warnings (e.g. detected full table scan in query review). */
  warnings?: string[];
}

/** Data-scope ranking: higher means more data may be shared. */
export const SCOPE_RANK: Record<AiContextMode, number> = {
  schema_only: 0,
  manual: 1,
  full: 2,
};

export interface AiFeatureMeta {
  key: AiFeature;
  label: string;
  description: string;
  /** Minimum data scope required for this feature to function. */
  minScope: AiContextMode;
  /** Lucide icon name, resolved in the UI. */
  icon: string;
}

/** The 12 AI features (Part 13). `minScope` powers the "unavailable in this mode" hints. */
export const AI_FEATURES: AiFeatureMeta[] = [
  {
    key: 'nl_to_sql',
    label: 'Natural Language → SQL',
    description: 'Describe what you want; get a query.',
    minScope: 'schema_only',
    icon: 'WandSparkles',
  },
  {
    key: 'explain_sql',
    label: 'SQL Explanation',
    description: 'Explain a query in plain English.',
    minScope: 'schema_only',
    icon: 'BookOpen',
  },
  {
    key: 'optimize_query',
    label: 'Query Optimization',
    description: 'Suggest faster alternatives.',
    minScope: 'schema_only',
    icon: 'Gauge',
  },
  {
    key: 'explain_error',
    label: 'Error Explanation',
    description: 'Translate a PostgreSQL error into an actionable fix.',
    minScope: 'schema_only',
    icon: 'TriangleAlert',
  },
  {
    key: 'schema_understanding',
    label: 'Schema Understanding',
    description: 'Ask how parts of the schema work together.',
    minScope: 'schema_only',
    icon: 'Network',
  },
  {
    key: 'data_discovery',
    label: 'Data Discovery',
    description: 'Find where information is stored.',
    minScope: 'schema_only',
    icon: 'Search',
  },
  {
    key: 'documentation',
    label: 'Documentation Generator',
    description: 'Generate markdown docs from the schema.',
    minScope: 'schema_only',
    icon: 'FileText',
  },
  {
    key: 'migration',
    label: 'Migration Generator',
    description: 'Generate migration SQL from a description.',
    minScope: 'schema_only',
    icon: 'GitBranch',
  },
  {
    key: 'refactor',
    label: 'Query Refactoring',
    description: 'Rewrite inefficient SQL.',
    minScope: 'schema_only',
    icon: 'Sparkles',
  },
  {
    key: 'test_data',
    label: 'Test Data Generator',
    description: 'Generate realistic sample rows.',
    minScope: 'schema_only',
    icon: 'Rows3',
  },
  {
    key: 'business_question',
    label: 'Business Question Mode',
    description: 'Answer a question by running a query against your data.',
    minScope: 'manual',
    icon: 'MessageCircleQuestion',
  },
  {
    key: 'query_review',
    label: 'Query Review',
    description: 'Analyze query risk (full scans, mass deletes, missing WHERE).',
    minScope: 'schema_only',
    icon: 'ShieldCheck',
  },
];

/** Whether a feature is usable under the given data scope. */
export function isFeatureAvailable(feature: AiFeature, scope: AiContextMode): boolean {
  const meta = AI_FEATURES.find((f) => f.key === feature);
  return meta ? SCOPE_RANK[scope] >= SCOPE_RANK[meta.minScope] : false;
}

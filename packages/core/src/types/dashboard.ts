/**
 * Saved dashboards: a named collection of chart widgets, each backed by a SQL query.
 *
 * Dashboards are per-connection (like saved queries) and persisted in the local application store.
 * A widget runs its `sql` through the normal query path and visualises the result according to its
 * {@link ChartType} and axis mapping. AI can author a widget (NL → SQL + a suggested chart), but a
 * dashboard never re-runs anything automatically without the user asking.
 */

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'number' | 'table';

export interface DashboardWidget {
  id: string;
  title: string;
  /** The SQL the widget runs to get its data. */
  sql: string;
  chartType: ChartType;
  /** Column used for the category / x-axis (bar, line, area, pie). */
  labelColumn?: string;
  /** Column(s) used for the numeric series / y-axis. First is used for pie & number. */
  valueColumns?: string[];
  /** Layout span (1 = half width, 2 = full width). Defaults to 1. */
  span?: 1 | 2;
}

export interface Dashboard {
  id: string;
  connectionId: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  createdAt: string;
  updatedAt: string;
}

/** Payload accepted by `dashboards.save` when creating or updating a dashboard. */
export type DashboardInput = Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export const CHART_TYPES: { type: ChartType; label: string }[] = [
  { type: 'bar', label: 'Bar' },
  { type: 'line', label: 'Line' },
  { type: 'area', label: 'Area' },
  { type: 'pie', label: 'Pie' },
  { type: 'number', label: 'Number' },
  { type: 'table', label: 'Table' },
];

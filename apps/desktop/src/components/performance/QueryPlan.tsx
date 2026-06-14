import { useMemo } from 'react';
import {
  TriangleAlert,
  Search,
  Database,
  Combine,
  GitMerge,
  Layers,
  ArrowDownNarrowWide,
} from 'lucide-react';
import { cn } from '@swyftgrid/ui';

/** A loosely-typed EXPLAIN (FORMAT JSON) plan node. */
interface PlanNode {
  'Node Type'?: string;
  'Relation Name'?: string;
  'Plan Rows'?: number;
  'Actual Rows'?: number;
  'Total Cost'?: number;
  'Actual Total Time'?: number;
  'Index Name'?: string;
  Filter?: string;
  Plans?: PlanNode[];
}

interface PlanWarning {
  level: 'warning' | 'critical';
  message: string;
}

const LARGE_ROWS = 10_000;

/** Render a human-readable EXPLAIN plan with performance warnings (Part 3). */
export function QueryPlan({ plan, analyzed }: { plan: unknown; analyzed?: boolean }) {
  const root = useMemo(() => extractRoot(plan), [plan]);
  const warnings = useMemo(() => (root ? collectWarnings(root) : []), [root]);

  if (!root) {
    return <div className="p-4 text-xs text-content-subtle">No plan to display.</div>;
  }

  return (
    <div className="space-y-3">
      {warnings.length > 0 && (
        <div className="space-y-1.5">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs',
                w.level === 'critical'
                  ? 'border-danger/30 bg-danger/5 text-danger'
                  : 'border-warning/30 bg-warning/5 text-warning',
              )}
            >
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> {w.message}
            </div>
          ))}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface p-2">
        <PlanTree node={root} depth={0} analyzed={analyzed} />
      </div>
    </div>
  );
}

function PlanTree({
  node,
  depth,
  analyzed,
}: {
  node: PlanNode;
  depth: number;
  analyzed?: boolean;
}) {
  const type = node['Node Type'] ?? 'Node';
  const rows = node['Plan Rows'] ?? 0;
  const cost = node['Total Cost'];
  const time = node['Actual Total Time'];
  const seqScanLarge = type.includes('Seq Scan') && rows > LARGE_ROWS;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs',
          seqScanLarge ? 'bg-warning/5' : 'hover:bg-surface-2',
        )}
        style={{ marginLeft: depth * 16 }}
      >
        <NodeIcon type={type} />
        <span className="font-medium">{type}</span>
        {node['Relation Name'] && (
          <span className="text-content-subtle">on {node['Relation Name']}</span>
        )}
        {node['Index Name'] && (
          <span className="text-content-subtle">using {node['Index Name']}</span>
        )}
        <span className="ml-auto flex items-center gap-3 text-2xs text-content-muted">
          {cost != null && <span>cost {cost.toFixed(2)}</span>}
          <span>{rows.toLocaleString()} rows</span>
          {analyzed && time != null && <span className="text-accent">{time.toFixed(2)} ms</span>}
        </span>
      </div>
      {node.Filter && (
        <div className="text-2xs text-content-subtle" style={{ marginLeft: depth * 16 + 28 }}>
          Filter: <span className="font-mono">{node.Filter}</span>
        </div>
      )}
      {node.Plans?.map((child, i) => (
        <PlanTree key={i} node={child} depth={depth + 1} analyzed={analyzed} />
      ))}
    </div>
  );
}

function NodeIcon({ type }: { type: string }) {
  const cls = 'h-3.5 w-3.5 shrink-0';
  if (type.includes('Index')) return <Search className={cn(cls, 'text-success')} />;
  if (type.includes('Seq Scan')) return <Database className={cn(cls, 'text-warning')} />;
  if (type.includes('Nested Loop')) return <Combine className={cn(cls, 'text-danger')} />;
  if (type.includes('Hash')) return <Layers className={cn(cls, 'text-info')} />;
  if (type.includes('Merge')) return <GitMerge className={cn(cls, 'text-info')} />;
  return <ArrowDownNarrowWide className={cn(cls, 'text-content-subtle')} />;
}

function extractRoot(plan: unknown): PlanNode | null {
  if (Array.isArray(plan) && plan[0] && typeof plan[0] === 'object' && 'Plan' in plan[0]) {
    return (plan[0] as { Plan: PlanNode }).Plan;
  }
  if (plan && typeof plan === 'object' && 'Plan' in plan) {
    return (plan as { Plan: PlanNode }).Plan;
  }
  return null;
}

function collectWarnings(node: PlanNode, acc: PlanWarning[] = []): PlanWarning[] {
  const type = node['Node Type'] ?? '';
  const rows = node['Plan Rows'] ?? 0;
  if (type.includes('Seq Scan') && rows > LARGE_ROWS) {
    acc.push({
      level: 'warning',
      message: `Sequential scan on large table${node['Relation Name'] ? ` "${node['Relation Name']}"` : ''} (${rows.toLocaleString()} rows)`,
    });
    if (node.Filter) {
      acc.push({
        level: 'warning',
        message: `Missing index detected: filter on ${node['Relation Name'] ?? 'table'} is not index-backed`,
      });
    }
  }
  if (type.includes('Nested Loop') && rows > LARGE_ROWS) {
    acc.push({
      level: 'critical',
      message: `Expensive nested loop producing ${rows.toLocaleString()} rows — consider a hash/merge join`,
    });
  }
  node.Plans?.forEach((c) => collectWarnings(c, acc));
  return acc;
}

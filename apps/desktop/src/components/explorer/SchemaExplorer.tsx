import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Table2,
  Eye,
  FolderTree,
  Folder,
  FunctionSquare,
  Puzzle,
  Search,
  Box,
} from 'lucide-react';
import type { SchemaTreeNode } from '@swyftgrid/core';
import { cn, Spinner } from '@swyftgrid/ui';
import { invoke } from '@/lib/ipc';
import { openTable } from '@/lib/actions';

export function SchemaExplorer({ connectionId }: { connectionId: string }) {
  const [roots, setRoots] = useState<SchemaTreeNode[] | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let active = true;
    setRoots(null);
    invoke('schema.tree', { connectionId }).then((nodes) => {
      if (active) setRoots(nodes);
    });
    return () => {
      active = false;
    };
  }, [connectionId]);

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 bg-surface p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-subtle" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter objects…"
            className="h-7 w-full rounded-md border border-border bg-surface-2 pl-7 pr-2 text-xs outline-none placeholder:text-content-subtle focus:border-accent"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {roots === null ? (
          <div className="flex items-center gap-2 px-3 py-4 text-xs text-content-subtle">
            <Spinner className="h-3.5 w-3.5" /> Loading schema…
          </div>
        ) : (
          roots.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              connectionId={connectionId}
              filter={filter.toLowerCase()}
              defaultExpanded
            />
          ))
        )}
      </div>
    </div>
  );
}

function TreeNode({
  node,
  depth,
  connectionId,
  filter,
  defaultExpanded = false,
}: {
  node: SchemaTreeNode;
  depth: number;
  connectionId: string;
  filter: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [children, setChildren] = useState<SchemaTreeNode[] | null>(node.children ?? null);
  const [loading, setLoading] = useState(false);

  const loadChildren = useCallback(async () => {
    if (children || !node.expandable) return;
    setLoading(true);
    const result = await invoke('schema.tree', { connectionId, nodeId: node.id });
    setChildren(result);
    setLoading(false);
  }, [children, connectionId, node.expandable, node.id]);

  // Auto-expand groups/schemas while filtering so matches are visible.
  useEffect(() => {
    if (filter && node.expandable) {
      setExpanded(true);
      void loadChildren();
    }
  }, [filter, node.expandable, loadChildren]);

  const onActivate = () => {
    if (node.expandable) {
      setExpanded((e) => !e);
      if (!expanded) void loadChildren();
    } else if (node.kind === 'table' || node.kind === 'view' || node.kind === 'materialized_view') {
      openTable(connectionId, node.schema ?? 'public', node.label);
    }
  };

  const matches = !filter || node.label.toLowerCase().includes(filter);
  // Hide leaf nodes that don't match the filter.
  if (!node.expandable && !matches) return null;

  return (
    <div>
      <button
        onClick={onActivate}
        className={cn(
          'group flex h-7 w-full items-center gap-1 rounded-md pr-2 text-left text-xs',
          'text-content-muted transition-colors hover:bg-surface-2 hover:text-content',
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        {node.expandable ? (
          <ChevronRight
            className={cn('h-3.5 w-3.5 shrink-0 transition-transform', expanded && 'rotate-90')}
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <NodeIcon node={node} />
        <span className="truncate">{node.label}</span>
        {node.groupKind && children && (
          <span className="ml-auto text-2xs text-content-subtle">{children.length}</span>
        )}
      </button>

      {expanded && (
        <div>
          {loading && (
            <div
              className="px-3 py-1 text-2xs text-content-subtle"
              style={{ paddingLeft: `${(depth + 1) * 12 + 18}px` }}
            >
              loading…
            </div>
          )}
          {children?.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              connectionId={connectionId}
              filter={filter}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeIcon({ node }: { node: SchemaTreeNode }) {
  const cls = 'h-3.5 w-3.5 shrink-0';
  const icon = useMemo(() => {
    switch (node.kind) {
      case 'schema':
        return <FolderTree className={cn(cls, 'text-accent')} />;
      case 'group':
        return <Folder className={cn(cls, 'text-content-subtle')} />;
      case 'table':
        return <Table2 className={cn(cls, 'text-info')} />;
      case 'view':
      case 'materialized_view':
        return <Eye className={cn(cls, 'text-success')} />;
      case 'function':
        return <FunctionSquare className={cn(cls, 'text-warning')} />;
      case 'extension':
        return <Puzzle className={cn(cls, 'text-content-subtle')} />;
      default:
        return <Box className={cls} />;
    }
  }, [node.kind]);
  return icon;
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  RefreshCw,
  Search,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  KeyRound,
  Loader2,
  X,
  GitCompare,
} from 'lucide-react';
import type {
  CellValue,
  FilterSpec,
  ForeignKeyTarget,
  TableInfo,
  TablePage,
  SortSpec,
} from '@swyftgrid/core';
import { formatNumber, formatDuration } from '@swyftgrid/core';
import { Button, cn } from '@swyftgrid/ui';
import { invoke, toBackendError } from '@/lib/ipc';
import { useConnections } from '@/stores/connections';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';
import { openTable } from '@/lib/actions';
import { FkCell } from './FkCell';
import { DataDiffModal } from './DataDiffModal';

const ROW_HEIGHT = 30;
const DEFAULT_WIDTH = 160;

export function TableBrowser({
  connectionId,
  schema,
  table,
  initialFilterColumn,
  initialFilterValue,
}: {
  connectionId: string;
  schema: string;
  table: string;
  initialFilterColumn?: string;
  initialFilterValue?: CellValue;
}) {
  const pushToast = useUi((s) => s.pushToast);
  const requestConfirm = useUi((s) => s.requestConfirm);
  const safety = useSettings((s) => s.settings.safety);
  const isProduction = useConnections(
    (s) => s.connections.find((c) => c.id === connectionId)?.environment === 'production',
  );

  const [info, setInfo] = useState<TableInfo | null>(null);
  const [page, setPage] = useState<TablePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [sort, setSort] = useState<SortSpec[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<FilterSpec[]>(
    initialFilterColumn !== undefined
      ? [{ column: initialFilterColumn, operator: 'eq', value: initialFilterValue ?? null }]
      : [],
  );
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [editing, setEditing] = useState<{ row: number; col: number; value: string } | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [showDiff, setShowDiff] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoke('schema.table', { connectionId, schema, table }).then(setInfo);
  }, [connectionId, schema, table]);

  // Debounce the search box so we don't fire a query per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      setOffset(0);
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(handle);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke('table.page', {
        connectionId,
        request: { schema, table, offset, limit: pageSize, sort, filters, search: debouncedSearch },
      });
      setPage(result);
    } catch (err) {
      pushToast(toBackendError(err).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [connectionId, schema, table, offset, pageSize, sort, filters, debouncedSearch, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const fields = page?.fields ?? [];
  const rows = page?.rows ?? [];
  const pkColumns = useMemo(
    () => info?.columns.filter((c) => c.isPrimaryKey).map((c) => c.name) ?? [],
    [info],
  );
  const fkByColumn = useMemo(() => {
    const map = new Map<string, ForeignKeyTarget>();
    info?.columns.forEach((c) => c.references && map.set(c.name, c.references));
    return map;
  }, [info]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const toggleSort = (col: string) => {
    setOffset(0);
    setSort((prev) => {
      const existing = prev.find((s) => s.column === col);
      if (!existing) return [{ column: col, direction: 'asc' }];
      if (existing.direction === 'asc') return [{ column: col, direction: 'desc' }];
      return [];
    });
  };

  const copyCell = (value: CellValue) => {
    navigator.clipboard.writeText(value === null ? '' : String(value));
    pushToast('Cell copied', 'success');
  };

  const copyRowJson = (rowIndex: number) => {
    const obj: Record<string, CellValue> = {};
    fields.forEach((f, i) => (obj[f.name] = rows[rowIndex]![i] ?? null));
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    pushToast('Row copied as JSON', 'success');
  };

  const commitEdit = async () => {
    if (!editing) return;
    const { row, col, value } = editing;
    const field = fields[col]!;
    const original = rows[row]![col];
    setEditing(null);
    if (String(original ?? '') === value) return;
    if (pkColumns.length === 0) {
      pushToast('Cannot edit: table has no primary key.', 'error');
      return;
    }
    const primaryKey: Record<string, CellValue> = {};
    pkColumns.forEach((pk) => {
      const idx = fields.findIndex((f) => f.name === pk);
      primaryKey[pk] = rows[row]![idx] ?? null;
    });
    try {
      await invoke('table.updateRow', {
        connectionId,
        edit: { schema, table, primaryKey, changes: { [field.name]: value } },
      });
      setPage((p) =>
        p
          ? {
              ...p,
              rows: p.rows.map((r, i) =>
                i === row ? r.map((c, j) => (j === col ? value : c)) : r,
              ),
            }
          : p,
      );
      pushToast('Row updated', 'success');
    } catch (err) {
      pushToast(toBackendError(err).message, 'error');
    }
  };

  const deleteSelectedRow = async () => {
    if (selected === null || pkColumns.length === 0) {
      pushToast('Select a row with a primary key to delete.', 'error');
      return;
    }
    const rowIndex = selected.row;
    const primaryKey: Record<string, CellValue> = {};
    pkColumns.forEach((pk) => {
      const idx = fields.findIndex((f) => f.name === pk);
      primaryKey[pk] = rows[rowIndex]![idx] ?? null;
    });
    // Safe Delete: ask the backend for the impact (dependencies) before confirming.
    const impact = await invoke('safety.deleteImpact', {
      connectionId,
      schema,
      table,
      operation: 'DELETE',
    }).catch(() => null);

    requestConfirm({
      title: 'Delete row?',
      message: 'This permanently removes the row from the database.',
      detail: `DELETE FROM ${schema}.${table}\nWHERE ${pkColumns
        .map((p) => `${p} = ${JSON.stringify(primaryKey[p])}`)
        .join(' AND ')}`,
      dependencies: impact?.dependencies,
      confirmLabel: 'Delete row',
      tone: 'danger',
      confirmPhrase:
        safety.requireTypeToConfirm && (isProduction || safety.alwaysConfirmDestructive)
          ? `DELETE ${table}`
          : undefined,
      onConfirm: async () => {
        try {
          await invoke('table.deleteRow', { connectionId, del: { schema, table, primaryKey } });
          setSelected(null);
          await load();
          pushToast('Row deleted', 'success');
        } catch (err) {
          pushToast(toBackendError(err).message, 'error');
        }
      },
    });
  };

  const total = page?.estimatedTotal ?? 0;
  const colWidth = (name: string) => widths[name] ?? DEFAULT_WIDTH;
  const gridWidth = fields.reduce((sum, f) => sum + colWidth(f.name), 48);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
        <span className="text-sm font-medium">
          <span className="text-content-subtle">{schema}.</span>
          {table}
        </span>
        {isProduction && (
          <span className="rounded bg-danger-soft px-1.5 py-0.5 text-2xs font-medium text-danger">
            production
          </span>
        )}
        <div className="relative ml-2 w-56">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rows…"
            className="h-7 w-full rounded-md border border-border bg-surface-2 pl-7 pr-2 text-xs outline-none focus:border-accent"
          />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setShowDiff(true)}>
            <GitCompare className="h-3.5 w-3.5" /> Compare
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void load()}>
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => pushToast('Insert row UI is coming soon.', 'info')}
          >
            <Plus className="h-3.5 w-3.5" /> Row
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={deleteSelectedRow}
            disabled={selected === null}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Active filter chips (relationship navigation lands here) */}
      {filters.length > 0 && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface-2/50 px-3 py-1.5">
          <span className="text-2xs text-content-subtle">Filtered:</span>
          {filters.map((f, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-2xs text-accent"
            >
              {f.column} = {String(f.value)}
              <button
                onClick={() => {
                  setOffset(0);
                  setFilters((prev) => prev.filter((_, j) => j !== i));
                }}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Grid */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-bg">
        <div style={{ width: gridWidth, minWidth: '100%' }}>
          {/* Header */}
          <div className="sticky top-0 z-10 flex border-b border-border bg-surface text-2xs font-medium text-content-muted">
            <div className="sticky left-0 z-10 w-12 shrink-0 border-r border-border bg-surface px-2 py-1.5 text-right">
              #
            </div>
            {fields.map((f) => {
              const sortDir = sort.find((s) => s.column === f.name)?.direction;
              const pk = pkColumns.includes(f.name);
              const fk = fkByColumn.has(f.name);
              return (
                <div
                  key={f.name}
                  style={{ width: colWidth(f.name) }}
                  className="group relative flex shrink-0 items-center gap-1 border-r border-border px-2 py-1.5"
                >
                  <button
                    onClick={() => toggleSort(f.name)}
                    className="flex min-w-0 flex-1 items-center gap-1 hover:text-content"
                  >
                    {pk && <KeyRound className="h-3 w-3 shrink-0 text-warning" />}
                    {fk && !pk && <span className="shrink-0 text-accent">↗</span>}
                    <span className="truncate">{f.name}</span>
                    {sortDir === 'asc' && <ArrowUp className="h-3 w-3" />}
                    {sortDir === 'desc' && <ArrowDown className="h-3 w-3" />}
                    <span className="ml-1 truncate font-normal text-content-subtle/70">
                      {f.dataTypeName}
                    </span>
                  </button>
                  <ColumnResizer
                    width={colWidth(f.name)}
                    onResize={(w) => setWidths((prev) => ({ ...prev, [f.name]: w }))}
                  />
                </div>
              );
            })}
          </div>

          {/* Rows */}
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vr) => {
              const rowIndex = vr.index;
              const row = rows[rowIndex]!;
              return (
                <div
                  key={vr.key}
                  className={cn(
                    'absolute left-0 flex w-full border-b border-border/60 text-xs',
                    selected?.row === rowIndex && 'bg-accent-soft/40',
                  )}
                  style={{ height: ROW_HEIGHT, transform: `translateY(${vr.start}px)` }}
                >
                  <div className="sticky left-0 z-[5] grid w-12 shrink-0 place-items-center border-r border-border bg-surface/95 text-2xs text-content-subtle">
                    {offset + rowIndex + 1}
                  </div>
                  {row.map((cell, colIndex) => {
                    const field = fields[colIndex]!;
                    const isEditing = editing?.row === rowIndex && editing.col === colIndex;
                    const isSelected = selected?.row === rowIndex && selected.col === colIndex;
                    const fk = fkByColumn.get(field.name);
                    return (
                      <div
                        key={colIndex}
                        style={{ width: colWidth(field.name) }}
                        onClick={() => setSelected({ row: rowIndex, col: colIndex })}
                        onDoubleClick={() =>
                          setEditing({
                            row: rowIndex,
                            col: colIndex,
                            value: cell === null ? '' : String(cell),
                          })
                        }
                        onContextMenu={(e) => {
                          e.preventDefault();
                          copyRowJson(rowIndex);
                        }}
                        className={cn(
                          'flex shrink-0 items-center gap-1 overflow-hidden border-r border-border/60 px-2',
                          isSelected && 'ring-1 ring-inset ring-accent',
                          cell === null && 'italic text-content-subtle/60',
                        )}
                        title={cell === null ? 'NULL' : String(cell)}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editing.value}
                            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit();
                              if (e.key === 'Escape') setEditing(null);
                            }}
                            className="h-full w-full bg-transparent text-xs outline-none"
                          />
                        ) : fk && cell !== null ? (
                          <FkCell
                            connectionId={connectionId}
                            target={fk}
                            value={cell}
                            onOpen={() =>
                              openTable(connectionId, fk.schema, fk.table, {
                                filterColumn: fk.column,
                                filterValue: cell,
                                newTab: true,
                              })
                            }
                          />
                        ) : (
                          <span className="truncate font-mono" onCopy={() => copyCell(cell)}>
                            {cell === null ? 'NULL' : String(cell)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {rows.length === 0 && !loading && (
            <div className="p-8 text-center text-sm text-content-subtle">No rows.</div>
          )}
        </div>
      </div>

      {/* Footer / pagination */}
      <div className="flex h-8 shrink-0 items-center justify-between border-t border-border bg-surface px-3 text-2xs text-content-muted">
        <span>
          Rows {total === 0 ? 0 : offset + 1}–{offset + rows.length} of ~{formatNumber(total)}
          {page && (
            <span className="ml-2 text-content-subtle">{formatDuration(page.executionMs)}</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => {
              setOffset(0);
              setPageSize(Number(e.target.value));
            }}
            className="rounded border border-border bg-surface-2 px-1 py-0.5 text-2xs outline-none"
          >
            {[50, 100, 250, 500].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - pageSize))}
            className="grid h-6 w-6 place-items-center rounded hover:bg-surface-2 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            disabled={offset + pageSize >= total}
            onClick={() => setOffset(offset + pageSize)}
            className="grid h-6 w-6 place-items-center rounded hover:bg-surface-2 disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showDiff && (
        <DataDiffModal
          connectionId={connectionId}
          schema={schema}
          table={table}
          onClose={() => setShowDiff(false)}
        />
      )}
    </div>
  );
}

function ColumnResizer({ width, onResize }: { width: number; onResize: (w: number) => void }) {
  const start = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = width;
    const move = (ev: MouseEvent) => onResize(Math.max(64, startWidth + (ev.clientX - startX)));
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  return (
    <div
      onMouseDown={start}
      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 transition-opacity hover:bg-accent hover:opacity-100 group-hover:opacity-40"
    />
  );
}

import { useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { CellValue, FieldInfo, ForeignKeyTarget, Row } from '@swyftgrid/core';
import { Spinner } from '@swyftgrid/ui';
import { invoke } from '@/lib/ipc';

/**
 * A foreign-key cell (Part 2). Renders the value with a clickable "open related record" affordance,
 * and shows a preview of the related row on hover so browsing feels like navigating a graph.
 */
export function FkCell({
  connectionId,
  target,
  value,
  onOpen,
}: {
  connectionId: string;
  target: ForeignKeyTarget;
  value: CellValue;
  onOpen: () => void;
}) {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ fields: FieldInfo[]; row: Row } | null>(null);
  const fetched = useRef(false);

  const loadPreview = async () => {
    setShow(true);
    if (fetched.current) return;
    fetched.current = true;
    setLoading(true);
    try {
      const page = await invoke('table.page', {
        connectionId,
        request: {
          schema: target.schema,
          table: target.table,
          offset: 0,
          limit: 1,
          sort: [],
          filters: [{ column: target.column, operator: 'eq', value }],
          search: '',
        },
      });
      if (page.rows[0]) setPreview({ fields: page.fields, row: page.rows[0] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <span
      className="relative flex min-w-0 items-center gap-1"
      onMouseEnter={loadPreview}
      onMouseLeave={() => setShow(false)}
    >
      <span className="truncate font-mono">{String(value)}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        title={`Open ${target.table}`}
        className="shrink-0 rounded p-0.5 text-accent opacity-60 transition-opacity hover:bg-accent-soft hover:opacity-100"
      >
        <ArrowUpRight className="h-3 w-3" />
      </button>

      {show && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 animate-fade-in rounded-lg border border-border bg-overlay p-2.5 shadow-popover">
          <div className="mb-1.5 flex items-center gap-1 text-2xs font-medium text-content-subtle">
            <ArrowUpRight className="h-3 w-3 text-accent" />
            {target.table}
          </div>
          {loading ? (
            <div className="flex items-center gap-2 py-1 text-2xs text-content-subtle">
              <Spinner className="h-3 w-3" /> Loading…
            </div>
          ) : preview ? (
            <div className="space-y-0.5">
              {preview.fields.slice(0, 8).map((f, i) => (
                <div key={f.name} className="flex gap-2 text-2xs">
                  <span className="w-20 shrink-0 truncate text-content-subtle">{f.name}</span>
                  <span className="min-w-0 flex-1 truncate font-mono">
                    {preview.row[i] === null ? 'NULL' : String(preview.row[i])}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-1 text-2xs text-content-subtle">No related record found.</div>
          )}
        </div>
      )}
    </span>
  );
}

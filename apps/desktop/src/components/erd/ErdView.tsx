import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Search,
  Image,
  FileCode,
  KeyRound,
  LayoutGrid,
} from 'lucide-react';
import type { SchemaSnapshot, TableInfo } from '@swyftgrid/core';
import { cn } from '@swyftgrid/ui';
import { invoke } from '@/lib/ipc';
import { useUi } from '@/stores/ui';

const NODE_W = 210;
const HEADER_H = 28;
const ROW_H = 19;

interface Pos {
  x: number;
  y: number;
}

interface ErdLayout {
  positions: Record<string, Pos>;
  scale?: number;
  translate?: Pos;
}

const layoutKey = (connectionId: string) => `swyftgrid:erd:${connectionId}`;

function loadLayout(connectionId: string): ErdLayout | null {
  try {
    const raw = localStorage.getItem(layoutKey(connectionId));
    return raw ? (JSON.parse(raw) as ErdLayout) : null;
  } catch {
    return null;
  }
}

function saveLayout(connectionId: string, layout: ErdLayout): void {
  try {
    localStorage.setItem(layoutKey(connectionId), JSON.stringify(layout));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/** Default grid placement for a table at index `i`. */
function gridPos(i: number): Pos {
  return { x: (i % 4) * 280, y: Math.floor(i / 4) * 260 };
}

export function ErdView({ connectionId }: { connectionId: string }) {
  const pushToast = useUi((s) => s.pushToast);
  const svgRef = useRef<SVGSVGElement>(null);
  const [snapshot, setSnapshot] = useState<SchemaSnapshot | null>(null);
  const [positions, setPositions] = useState<Record<string, Pos>>({});
  const [scale, setScale] = useState(0.9);
  const [translate, setTranslate] = useState<Pos>({ x: 40, y: 40 });
  const [search, setSearch] = useState('');
  const drag = useRef<{
    kind: 'node' | 'pan';
    key?: string;
    startX: number;
    startY: number;
    origin: Pos;
  } | null>(null);

  // Tracks whether the saved layout has been applied, so we don't persist before the first load.
  const loaded = useRef(false);

  useEffect(() => {
    invoke('schema.snapshot', { connectionId }).then((snap) => {
      setSnapshot(snap);
      // Restore the saved layout; auto-place any tables it doesn't know about (grid fallback).
      const saved = loadLayout(connectionId);
      const next: Record<string, Pos> = {};
      snap.tables.forEach((t, i) => {
        next[key(t)] = saved?.positions?.[key(t)] ?? gridPos(i);
      });
      setPositions(next);
      if (saved?.scale) setScale(saved.scale);
      if (saved?.translate) setTranslate(saved.translate);
      loaded.current = true;
    });
  }, [connectionId]);

  // Persist the layout (positions + zoom + pan) shortly after any change, so reopening the ER
  // diagram restores exactly where the user left it.
  useEffect(() => {
    if (!loaded.current) return;
    const handle = setTimeout(() => saveLayout(connectionId, { positions, scale, translate }), 400);
    return () => clearTimeout(handle);
  }, [connectionId, positions, scale, translate]);

  const resetLayout = () => {
    if (!snapshot) return;
    const next: Record<string, Pos> = {};
    snapshot.tables.forEach((t, i) => (next[key(t)] = gridPos(i)));
    setPositions(next);
    setScale(0.9);
    setTranslate({ x: 40, y: 40 });
  };

  const nodeHeight = (t: TableInfo) => HEADER_H + t.columns.length * ROW_H;

  const onMouseDown = (e: React.MouseEvent, k?: string) => {
    drag.current = {
      kind: k ? 'node' : 'pan',
      key: k,
      startX: e.clientX,
      startY: e.clientY,
      origin: k ? positions[k]! : translate,
    };
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / (d.kind === 'node' ? scale : 1);
      const dy = (e.clientY - d.startY) / (d.kind === 'node' ? scale : 1);
      if (d.kind === 'node' && d.key) {
        setPositions((p) => ({ ...p, [d.key!]: { x: d.origin.x + dx, y: d.origin.y + dy } }));
      } else {
        setTranslate({
          x: d.origin.x + (e.clientX - d.startX),
          y: d.origin.y + (e.clientY - d.startY),
        });
      }
    };
    const up = () => (drag.current = null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [scale]);

  const edges = useMemo(() => {
    if (!snapshot) return [];
    const byName = new Map(snapshot.tables.map((t) => [`${t.schema}.${t.name}`, t]));
    const result: { from: TableInfo; to: TableInfo }[] = [];
    for (const t of snapshot.tables) {
      for (const col of t.columns) {
        if (col.references) {
          const target = byName.get(`${col.references.schema}.${col.references.table}`);
          if (target) result.push({ from: t, to: target });
        }
      }
    }
    return result;
  }, [snapshot]);

  const exportSvg = () => {
    if (!svgRef.current) return;
    const data = new XMLSerializer().serializeToString(svgRef.current);
    download(new Blob([data], { type: 'image/svg+xml' }), 'schema.svg');
    pushToast('Exported SVG', 'success');
  };

  const exportPng = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svg.clientWidth * 2;
      canvas.height = svg.clientHeight * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = getComputedStyle(svg).backgroundColor || '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => b && download(b, 'schema.png'));
      pushToast('Exported PNG', 'success');
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)));
  };

  if (!snapshot) return <div className="p-8 text-sm text-content-subtle">Generating diagram…</div>;

  return (
    <div className="relative h-full overflow-hidden bg-bg">
      {/* Toolbar */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-border bg-surface/90 p-1 backdrop-blur">
        <ToolBtn onClick={() => setScale((s) => Math.min(2, s + 0.1))} label="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => setScale((s) => Math.max(0.3, s - 0.1))} label="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          onClick={() => {
            setScale(0.9);
            setTranslate({ x: 40, y: 40 });
          }}
          label="Reset view"
        >
          <Maximize className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={resetLayout} label="Reset layout (auto-arrange)">
          <LayoutGrid className="h-4 w-4" />
        </ToolBtn>
        <div className="mx-1 h-5 w-px bg-border" />
        <div className="relative w-44">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find table…"
            className="h-7 w-full rounded-md border border-border bg-surface-2 pl-7 pr-2 text-xs outline-none focus:border-accent"
          />
        </div>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolBtn onClick={exportPng} label="Export PNG">
          <Image className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={exportSvg} label="Export SVG">
          <FileCode className="h-4 w-4" />
        </ToolBtn>
      </div>

      <svg
        ref={svgRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => onMouseDown(e)}
        onWheel={(e) => setScale((s) => Math.min(2, Math.max(0.3, s - e.deltaY * 0.001)))}
      >
        <g transform={`translate(${translate.x},${translate.y}) scale(${scale})`}>
          {/* Relationship lines */}
          {edges.map((e, i) => {
            const a = positions[key(e.from)];
            const b = positions[key(e.to)];
            if (!a || !b) return null;
            const ax = a.x + NODE_W / 2;
            const ay = a.y + nodeHeight(e.from) / 2;
            const bx = b.x + NODE_W / 2;
            const by = b.y + nodeHeight(e.to) / 2;
            const mx = (ax + bx) / 2;
            return (
              <path
                key={i}
                d={`M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`}
                fill="none"
                stroke="rgb(var(--sg-accent))"
                strokeOpacity={0.4}
                strokeWidth={1.5}
              />
            );
          })}

          {/* Tables */}
          {snapshot.tables.map((t) => {
            const p = positions[key(t)];
            if (!p) return null;
            const highlighted = !!search && t.name.toLowerCase().includes(search.toLowerCase());
            return (
              <g key={key(t)} transform={`translate(${p.x},${p.y})`}>
                <rect
                  width={NODE_W}
                  height={nodeHeight(t)}
                  rx={8}
                  fill="rgb(var(--sg-surface))"
                  stroke={highlighted ? 'rgb(var(--sg-accent))' : 'rgb(var(--sg-border-strong))'}
                  strokeWidth={highlighted ? 2 : 1}
                />
                <rect
                  width={NODE_W}
                  height={HEADER_H}
                  rx={8}
                  fill="rgb(var(--sg-surface-2))"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onMouseDown(e, key(t));
                  }}
                  className="cursor-move"
                />
                <text
                  x={10}
                  y={HEADER_H / 2 + 4}
                  className="fill-content text-[11px] font-semibold"
                  style={{ fontWeight: 600 }}
                >
                  {t.name}
                </text>
                {t.columns.map((c, i) => (
                  <g key={c.name} transform={`translate(0,${HEADER_H + i * ROW_H})`}>
                    <text
                      x={10}
                      y={ROW_H / 2 + 4}
                      className="fill-content-muted text-[10px]"
                      style={{ fontSize: 10 }}
                    >
                      {c.isPrimaryKey ? '🔑 ' : c.references ? '↗ ' : ''}
                      {c.name}
                    </text>
                    <text
                      x={NODE_W - 8}
                      y={ROW_H / 2 + 4}
                      textAnchor="end"
                      className="fill-content-subtle text-[9px]"
                      style={{ fontSize: 9 }}
                    >
                      {c.dataType}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md border border-border bg-surface/80 px-2 py-1 text-2xs text-content-subtle backdrop-blur">
        <KeyRound className="h-3 w-3" /> {snapshot.tables.length} tables · {edges.length}{' '}
        relationships
      </div>
    </div>
  );
}

function key(t: TableInfo) {
  return `${t.schema}.${t.name}`;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function ToolBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-md text-content-muted hover:bg-surface-2 hover:text-content',
      )}
    >
      {children}
    </button>
  );
}

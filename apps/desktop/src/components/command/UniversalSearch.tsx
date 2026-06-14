import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { Table2, Columns3, FunctionSquare, Puzzle, Bookmark, Database } from 'lucide-react';
import type { DataSearchHit, SavedQuery, SchemaSnapshot } from '@swyftgrid/core';
import { useUi } from '@/stores/ui';
import { useConnections } from '@/stores/connections';
import { useSettings } from '@/stores/settings';
import { invoke } from '@/lib/ipc';
import { openTable, openEditor } from '@/lib/actions';
import { Overlay, GroupHeading, Item } from './CommandPalette';

/**
 * ⌘/Ctrl+K — the single search across schema objects, saved queries, and (when "search within
 * tables" is enabled in Settings) table data.
 */
export function UniversalSearch() {
  const open = useUi((s) => s.searchOpen);
  const close = useUi((s) => s.closeSearch);
  const searchWithinTables = useSettings((s) => s.settings.database.searchWithinTables);
  const active = useConnections((s) =>
    s.connections.find((c) => c.id === s.activeConnectionId && s.connectedIds.includes(c.id)),
  );

  const [query, setQuery] = useState('');
  const [snapshot, setSnapshot] = useState<SchemaSnapshot | null>(null);
  const [saved, setSaved] = useState<SavedQuery[]>([]);
  const [dataHits, setDataHits] = useState<DataSearchHit[]>([]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open || !active) return;
    invoke('schema.snapshot', { connectionId: active.id }).then(setSnapshot);
    invoke('savedQueries.list', { connectionId: active.id }).then((r) => setSaved(r.queries));
  }, [open, active]);

  // Debounced in-data search (only when enabled).
  useEffect(() => {
    if (!open || !active || !searchWithinTables || query.trim().length < 2) {
      setDataHits([]);
      return;
    }
    const handle = setTimeout(() => {
      invoke('search.data', { connectionId: active.id, term: query.trim(), limit: 40 })
        .then(setDataHits)
        .catch(() => setDataHits([]));
    }, 220);
    return () => clearTimeout(handle);
  }, [open, active, searchWithinTables, query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;
  if (!active) {
    return (
      <Overlay onClose={close}>
        <div className="px-4 py-10 text-center text-sm text-content-subtle">
          Connect to a database to search it.
        </div>
      </Overlay>
    );
  }

  const run = (fn: () => void) => () => {
    fn();
    close();
  };

  return (
    <Overlay onClose={close}>
      <Command className="flex max-h-[60vh] flex-col" loop>
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder={
            searchWithinTables ? `Search ${active.name} (incl. data)…` : `Search ${active.name}…`
          }
          className="h-12 w-full border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-content-subtle"
        />
        <Command.List className="overflow-y-auto p-1.5">
          <Command.Empty className="px-3 py-8 text-center text-sm text-content-subtle">
            {snapshot ? 'No matches.' : 'Indexing schema…'}
          </Command.Empty>

          {snapshot && (
            <>
              <Command.Group heading={<GroupHeading>Tables &amp; Views</GroupHeading>}>
                {snapshot.tables.map((t) => (
                  <Item
                    key={`${t.schema}.${t.name}`}
                    value={`${t.schema}.${t.name}`}
                    keywords={[t.kind]}
                    onSelect={run(() => openTable(active.id, t.schema, t.name))}
                  >
                    <Table2 className="h-4 w-4 text-info" />
                    <span className="flex-1">{t.name}</span>
                    <span className="text-2xs text-content-subtle">{t.schema}</span>
                  </Item>
                ))}
              </Command.Group>

              {dataHits.length > 0 && (
                <Command.Group heading={<GroupHeading>In data</GroupHeading>}>
                  {dataHits.map((h, i) => (
                    <Item
                      key={`${h.table}.${h.column}.${i}`}
                      value={`${h.value} ${h.table} ${h.column}`}
                      onSelect={run(() =>
                        openTable(active.id, h.schema, h.table, {
                          filterColumn: h.column,
                          filterValue: h.value,
                          newTab: true,
                        }),
                      )}
                    >
                      <Database className="h-4 w-4 text-accent" />
                      <span className="min-w-0 flex-1 truncate">{h.value}</span>
                      <span className="text-2xs text-content-subtle">
                        {h.table}.{h.column}
                      </span>
                    </Item>
                  ))}
                </Command.Group>
              )}

              <Command.Group heading={<GroupHeading>Columns</GroupHeading>}>
                {snapshot.tables.flatMap((t) =>
                  t.columns.slice(0, 50).map((col) => (
                    <Item
                      key={`${t.name}.${col.name}`}
                      value={`${t.name}.${col.name} ${col.dataType}`}
                      onSelect={run(() => openTable(active.id, t.schema, t.name))}
                    >
                      <Columns3 className="h-4 w-4 text-content-muted" />
                      <span className="flex-1">
                        {t.name}.<span className="font-medium">{col.name}</span>
                      </span>
                      <span className="text-2xs text-content-subtle">{col.dataType}</span>
                    </Item>
                  )),
                )}
              </Command.Group>

              {snapshot.functions.length > 0 && (
                <Command.Group heading={<GroupHeading>Functions</GroupHeading>}>
                  {snapshot.functions.map((f) => (
                    <Item
                      key={`${f.schema}.${f.name}`}
                      value={`${f.name} function`}
                      onSelect={run(() =>
                        openEditor(
                          active.id,
                          `SELECT ${f.schema}.${f.name}();`,
                          String(Date.now()),
                        ),
                      )}
                    >
                      <FunctionSquare className="h-4 w-4 text-warning" />
                      <span className="flex-1">
                        {f.name}({f.arguments})
                      </span>
                      <span className="text-2xs text-content-subtle">{f.returnType}</span>
                    </Item>
                  ))}
                </Command.Group>
              )}

              {snapshot.extensions.length > 0 && (
                <Command.Group heading={<GroupHeading>Extensions</GroupHeading>}>
                  {snapshot.extensions.map((e) => (
                    <Item key={e.name} value={`${e.name} extension`} onSelect={close}>
                      <Puzzle className="h-4 w-4 text-content-muted" />
                      <span className="flex-1">{e.name}</span>
                      <span className="text-2xs text-content-subtle">v{e.version}</span>
                    </Item>
                  ))}
                </Command.Group>
              )}
            </>
          )}

          {saved.length > 0 && (
            <Command.Group heading={<GroupHeading>Saved Queries</GroupHeading>}>
              {saved.map((q) => (
                <Item
                  key={q.id}
                  value={`${q.name} ${q.tags.join(' ')}`}
                  onSelect={run(() => openEditor(active.id, q.sql, q.id))}
                >
                  <Bookmark className="h-4 w-4 text-accent" />
                  <span className="flex-1">{q.name}</span>
                </Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </Overlay>
  );
}

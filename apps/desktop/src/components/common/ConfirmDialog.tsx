import { useEffect, useState } from 'react';
import { AlertTriangle, Link2 } from 'lucide-react';
import { Button } from '@swyftgrid/ui';
import { useUi } from '@/stores/ui';

/** A modal confirmation used by Production Safety, Safe Delete, and other destructive actions. */
export function ConfirmDialog() {
  const confirm = useUi((s) => s.confirm);
  const resolve = useUi((s) => s.resolveConfirm);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    setTyped('');
  }, [confirm]);

  useEffect(() => {
    if (!confirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolve();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirm, resolve]);

  if (!confirm) return null;
  const danger = confirm.tone === 'danger';
  const phraseOk = !confirm.confirmPhrase || typed.trim() === confirm.confirmPhrase;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={resolve} />
      <div className="relative z-10 w-full max-w-md animate-scale-in rounded-xl border border-border bg-overlay p-5 shadow-popover">
        <div className="flex items-start gap-3">
          {danger && (
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
              <AlertTriangle className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">{confirm.title}</h3>
            <p className="mt-1 text-sm text-content-muted">{confirm.message}</p>

            {confirm.dependencies && confirm.dependencies.length > 0 && (
              <div className="mt-3 rounded-md border border-warning/30 bg-warning/5 p-2">
                <div className="mb-1 flex items-center gap-1 text-2xs font-medium text-warning">
                  <Link2 className="h-3 w-3" /> {confirm.dependencies.length} dependent object(s)
                </div>
                <ul className="space-y-0.5 text-2xs text-content-muted">
                  {confirm.dependencies.map((d, i) => (
                    <li key={i} className="font-mono">
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {confirm.detail && (
              <pre className="mt-3 max-h-32 overflow-auto rounded-md border border-border bg-surface-2 p-2 font-mono text-2xs text-content-muted">
                {confirm.detail}
              </pre>
            )}

            {confirm.confirmPhrase && (
              <div className="mt-3">
                <p className="mb-1 text-xs text-content-muted">
                  Type{' '}
                  <span className="font-mono font-semibold text-content">
                    {confirm.confirmPhrase}
                  </span>{' '}
                  to confirm:
                </p>
                <input
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-surface px-2 font-mono text-sm outline-none focus:border-danger"
                />
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={resolve}>
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            disabled={!phraseOk}
            onClick={() => {
              confirm.onConfirm();
              resolve();
            }}
          >
            {confirm.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}

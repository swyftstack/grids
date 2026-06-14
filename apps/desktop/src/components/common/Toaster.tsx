import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { cn } from '@swyftgrid/ui';
import { useUi, type Toast } from '@/stores/ui';

const ICON = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const TONE = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-info',
};

export function Toaster() {
  const { toasts, dismissToast } = useUi();
  return (
    <div className="pointer-events-none fixed bottom-10 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismissToast(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = ICON[toast.tone];
  return (
    <div
      onClick={onDismiss}
      className="pointer-events-auto flex animate-slide-up cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-overlay p-3 shadow-popover"
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', TONE[toast.tone])} />
      <p className="text-xs leading-relaxed text-content">{toast.message}</p>
    </div>
  );
}

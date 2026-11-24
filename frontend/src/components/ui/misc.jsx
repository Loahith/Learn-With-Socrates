import { Loader2, X, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/store/toast";

export function Badge({ tone = "grey", className, ...props }) {
  const tones = {
    grey: "bg-black/5 text-grey",
    green: "bg-brand/10 text-brand",
    gold: "bg-gold/25 text-[#7a5d22]",
    red: "bg-red-50 text-red-600",
    blue: "bg-sky-50 text-sky-700",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)} {...props} />
  );
}

export function ProgressBar({ value = 0, className, color = "bg-brand" }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-line", className)}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cn("animate-pulse rounded-xl bg-black/6", className)} />;
}

export function Spinner({ className }) {
  return <Loader2 className={cn("animate-spin text-brand", className)} size={20} />;
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center">
      {Icon && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
          <Icon size={24} />
        </span>
      )}
      <h3 className="text-lg font-bold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-grey">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={cn("max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grey hover:bg-black/5" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toaster() {
  const { toasts, remove } = useToast();
  const icon = { success: CheckCircle2, error: AlertTriangle, info: Info };
  const color = { success: "text-brand", error: "text-red-600", info: "text-sky-600" };
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = icon[t.type];
        return (
          <div key={t.id} className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4 shadow-lg" role="status">
            <Icon size={20} className={cn("mt-0.5 shrink-0", color[t.type])} />
            <p className="flex-1 text-sm">{t.message}</p>
            <button onClick={() => remove(t.id)} className="text-grey" aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

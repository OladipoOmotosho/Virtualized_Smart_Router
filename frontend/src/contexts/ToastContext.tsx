import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "error" | "success" | "info";

interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
  durationMs: number;
}

interface ToastContextValue {
  error: (message: string, durationMs?: number) => void;
  success: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextIdRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string, durationMs = DEFAULT_DURATION_MS) => {
      const id = nextIdRef.current++;
      setToasts((prev) => [...prev, { id, variant, message, durationMs }]);
    },
    [],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      error: (msg, d) => push("error", msg, d),
      success: (msg, d) => push("success", msg, d),
      info: (msg, d) => push("info", msg, d),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

const VARIANT_STYLES: Record<
  ToastVariant,
  { container: string; bar: string; icon: React.ReactNode }
> = {
  error: {
    container: "bg-white border-red-200",
    bar: "bg-red-500",
    icon: <AlertCircle size={18} className="text-red-500 shrink-0" />,
  },
  success: {
    container: "bg-white border-green-200",
    bar: "bg-green-500",
    icon: <CheckCircle2 size={18} className="text-green-500 shrink-0" />,
  },
  info: {
    container: "bg-white border-blue-200",
    bar: "bg-blue-500",
    icon: <Info size={18} className="text-blue-500 shrink-0" />,
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const [progress, setProgress] = useState(1);
  const styles = VARIANT_STYLES[toast.variant];

  useEffect(() => {
    const startedAt = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, 1 - elapsed / toast.durationMs);
      setProgress(remaining);
      if (remaining <= 0) onDismiss(toast.id);
    };
    const intervalId = window.setInterval(tick, 50);
    return () => window.clearInterval(intervalId);
  }, [toast.id, toast.durationMs, onDismiss]);

  return (
    <div
      role="alert"
      className={cn(
        "relative overflow-hidden rounded-lg border shadow-lg animate-in slide-in-from-right",
        styles.container,
      )}
    >
      <div className="flex items-start gap-3 p-3 pr-8">
        {styles.icon}
        <p className="text-sm text-gray-800 leading-snug flex-1">{toast.message}</p>
        <button
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss"
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <div className="h-1 bg-gray-100">
        <div
          className={cn("h-full transition-[width] duration-75 ease-linear", styles.bar)}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

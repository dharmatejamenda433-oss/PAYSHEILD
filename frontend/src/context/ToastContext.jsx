import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from 'lucide-react';
import { cn } from '../utils/cn';

const ToastContext = createContext(null);

const TONES = {
  success: {
    icon: CheckCircle2,
    frame: 'border-emerald-200 bg-white',
    iconWrap: 'bg-emerald-50 text-emerald-600',
    bar: 'bg-emerald-500',
  },
  error: {
    icon: XCircle,
    frame: 'border-rose-200 bg-white',
    iconWrap: 'bg-rose-50 text-rose-600',
    bar: 'bg-rose-500',
  },
  warning: {
    icon: AlertTriangle,
    frame: 'border-amber-200 bg-white',
    iconWrap: 'bg-amber-50 text-amber-600',
    bar: 'bg-amber-500',
  },
  info: {
    icon: Info,
    frame: 'border-slate-200 bg-white',
    iconWrap: 'bg-blue-50 text-blue-600',
    bar: 'bg-blue-500',
  },
};

let nextId = 0;

/**
 * Lightweight toast system. Toasts are rendered through a portal so they sit
 * above dialogs and never clip inside layout containers.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      nextId += 1;
      const id = nextId;
      const duration = toast.duration ?? 5200;

      setToasts((current) => [...current.slice(-3), { ...toast, id }]);

      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }

      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      push,
      dismiss,
      success: (title, message) => push({ tone: 'success', title, message }),
      error: (title, message) => push({ tone: 'error', title, message }),
      warning: (title, message) => push({ tone: 'warning', title, message }),
      info: (title, message) => push({ tone: 'info', title, message }),
    }),
    [push, dismiss]
  );

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-4 bottom-4 z-[80] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px]"
        >
          {toasts.map((toast) => {
            const tone = TONES[toast.tone] || TONES.info;
            const Icon = tone.icon;

            return (
              <div
                key={toast.id}
                role="status"
                className={cn(
                  'animate-rise pointer-events-auto flex w-full overflow-hidden rounded-xl border shadow-lifted',
                  tone.frame
                )}
              >
                <div className={cn('w-1 shrink-0', tone.bar)} />
                <div className="flex flex-1 items-start gap-3 p-3.5">
                  <span
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      tone.iconWrap
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {toast.title}
                    </p>
                    {toast.message ? (
                      <p className="mt-0.5 text-sm leading-snug text-slate-600">
                        {toast.message}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(toast.id)}
                    className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Dismiss notification"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside a ToastProvider.');
  }
  return context;
}

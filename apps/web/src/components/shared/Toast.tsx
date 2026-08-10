'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  detail?: string;
}

interface ToastContextValue {
  toast: (t: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const TONE_STYLES: Record<ToastTone, string> = {
  success: 'border-success/50 text-success-muted',
  error: 'border-accent/50 text-accent-hover',
  info: 'border-info/50 text-info-muted',
  warning: 'border-warning/50 text-warning-muted',
};

const TONE_LABELS: Record<ToastTone, string> = {
  success: 'Success',
  error: 'Error',
  info: 'Information',
  warning: 'Warning',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = `toast-${++counter.current}`;
      setToasts((prev) => [...prev, { ...t, id }]);
      window.setTimeout(() => dismiss(id), 6000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[90] flex w-full max-w-sm flex-col gap-2"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-enter card flex items-start justify-between gap-3 border-l-4 ${TONE_STYLES[t.tone]}`}
          >
            <div>
              <p className="text-sm font-medium text-text">
                <span className="sr-only">{TONE_LABELS[t.tone]}: </span>
                {t.title}
              </p>
              {t.detail && <p className="mt-1 text-xs text-text-muted">{t.detail}</p>}
            </div>
            <button
              className="text-text-muted hover:text-text transition-colors"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

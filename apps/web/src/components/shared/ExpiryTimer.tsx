'use client';

import React, { useEffect, useState } from 'react';

export interface ExpiryTimerProps {
  expiresAt: string; // ISO-8601
  onExpire?: () => void;
}

function remaining(expiresAt: string): { total: number; label: string; expired: boolean } {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { total: 0, label: 'Expired', expired: true };
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return { total: ms, label: `Less than a minute`, expired: false };
  if (mins < 60) return { total: ms, label: `Expires in ${mins} min`, expired: false };
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return { total: ms, label: `Expires in ${hrs}h ${remMins}m`, expired: false };
}

export function ExpiryTimer({ expiresAt, onExpire }: ExpiryTimerProps) {
  const [state, setState] = useState(() => remaining(expiresAt));
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = remaining(expiresAt);
      setState(next);
      if (next.expired && !expired) {
        setExpired(true);
        onExpire?.();
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [expiresAt, expired, onExpire]);

  return (
    <span
      className={`font-mono text-[11px] ${state.expired ? 'text-accent-hover' : 'text-warning-muted'}`}
      aria-live="polite"
      title={new Date(expiresAt).toLocaleString()}
    >
      {state.label}
    </span>
  );
}

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

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
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const initial = remaining(expiresAt);
    setState(initial);
    if (initial.expired && !expiredRef.current) {
      expiredRef.current = true;
      onExpireRef.current?.();
      return;
    }

    const timer = window.setInterval(() => {
      const next = remaining(expiresAt);
      setState(next);
      if (next.expired && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current?.();
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

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

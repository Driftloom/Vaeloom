'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';

export function TopNav({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? 'U');

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="md:hidden text-text-muted hover:text-text transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </button>
        <div className="font-display text-sm text-text-muted">Workspace</div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-xs font-mono text-text-dim hidden sm:block">Enterprise Mode</div>
        <button
          onClick={handleLogout}
          className="text-xs font-mono text-text-muted hover:text-text transition-colors"
          aria-label="Log out"
        >
          Log out
        </button>
        <div
          className="w-8 h-8 rounded-full bg-surface-200 border border-border flex items-center justify-center text-text-muted font-mono text-xs"
          title={user?.email ?? 'User'}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}

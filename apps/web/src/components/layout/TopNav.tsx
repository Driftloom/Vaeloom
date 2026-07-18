'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';

export function TopNav() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const initials = user?.displayName
    ? user.displayName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? 'U';

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <header className="h-16 border-b border-border bg-surface flex items-center justify-between px-6 shrink-0">
      <div className="font-display text-text">Workspace</div>
      <div className="flex items-center gap-4">
        <div className="text-sm font-mono text-text-muted hidden sm:block">
          Enterprise Mode
        </div>
        <button
          onClick={handleLogout}
          className="text-xs font-mono text-text-muted hover:text-text transition-colors"
          aria-label="Log out"
        >
          Log out
        </button>
        <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center text-primary font-mono text-xs" title={user?.email ?? 'User'}>
          {initials}
        </div>
      </div>
    </header>
  );
}

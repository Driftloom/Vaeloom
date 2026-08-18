'use client';

'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Shortcut {
  keys: string;
  description: string;
  handler: () => void;
}

interface KeyboardShortcutContextValue {
  shortcuts: Shortcut[];
  registerShortcut: (keys: string, description: string, handler: () => void) => () => void;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
}

const KeyboardShortcutContext = createContext<KeyboardShortcutContextValue>({
  shortcuts: [],
  registerShortcut: () => () => {},
  showModal: false,
  setShowModal: (() => {}) as React.Dispatch<React.SetStateAction<boolean>>,
});

export function KeyboardShortcutProvider({ children }: { children: React.ReactNode }) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [showModal, setShowModal] = useState(false);

  const registerShortcut = useCallback((keys: string, description: string, handler: () => void) => {
    const entry: Shortcut = { keys, description, handler };
    setShortcuts((prev) => [...prev, entry]);
    return () => {
      setShortcuts((prev) => prev.filter((s) => s !== entry));
    };
  }, []);

  const value = useMemo(
    () => ({ shortcuts, registerShortcut, showModal, setShowModal }),
    [shortcuts, registerShortcut, showModal],
  );

  return (
    <KeyboardShortcutContext.Provider value={value}>{children}</KeyboardShortcutContext.Provider>
  );
}

export function useKeyboardShortcuts() {
  const ctx = useContext(KeyboardShortcutContext);
  if (!ctx) throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutProvider');
  return ctx;
}

export function KeyboardShortcutsModal() {
  const { shortcuts, showModal, setShowModal } = useKeyboardShortcuts();
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (showModal) {
      closeRef.current?.focus();
    }
  }, [showModal]);

  React.useEffect(() => {
    if (!showModal) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowModal(false);
        return;
      }
      if (e.key === 'Tab') {
        const modal = document.querySelector('[role="dialog"]');
        if (!modal) return;
        const focusable = modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showModal, setShowModal]);

  if (!showModal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => setShowModal(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="bg-surface border border-border rounded-lg shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-display font-semibold text-text mb-4">Keyboard Shortcuts</h2>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.keys} className="flex items-center justify-between">
              <span className="text-sm text-text-muted">{s.description}</span>
              <kbd className="px-2 py-0.5 text-xs font-mono bg-surface-hover border border-border rounded text-text">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-text-muted">
          Press{' '}
          <kbd className="px-1 py-0.5 bg-surface-hover border border-border rounded font-mono">
            ?
          </kbd>{' '}
          to toggle this modal
        </p>
        <button
          ref={closeRef}
          onClick={() => setShowModal(false)}
          className="mt-4 w-full px-3 py-1.5 text-sm text-text bg-surface-hover border border-border rounded hover:bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-background"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// --- Default shortcut registration ---
export function useRegisterDefaultShortcuts() {
  const { registerShortcut, setShowModal } = useKeyboardShortcuts();
  const router = useRouter();

  useEffect(() => {
    const unregisters: (() => void)[] = [];

    // Navigation shortcuts use g+key pattern
    const navShortcuts: [string, string, string][] = [
      ['g d', 'Dashboard', '/workspace/'],
      ['g m', 'Memory', 'memory'],
      ['g j', 'Jobs', 'jobs'],
      ['g r', 'Resume', 'resume'],
      ['g s', 'Settings', 'settings'],
      ['g c', 'Chat', 'chat'],
    ];

    navShortcuts.forEach(([keys, desc, path]) => {
      unregisters.push(
        registerShortcut(keys, desc, () => {
          router.push(path.startsWith('/') ? path : `/workspace/${path}`);
        }),
      );
    });

    unregisters.push(
      registerShortcut('/', 'Search', () => {
        document.querySelector<HTMLInputElement>('[data-search-input]')?.focus();
      }),
    );

    unregisters.push(
      registerShortcut('n', 'New item', () => {
        const btn = document.querySelector<HTMLButtonElement>('[data-new-item]');
        btn?.click();
      }),
    );

    unregisters.push(
      registerShortcut('?', 'Show shortcuts', () => {
        setShowModal((prev) => !prev);
      }),
    );

    return () => unregisters.forEach((u) => u());
  }, [registerShortcut, setShowModal, router]);
}

// --- Global keyboard listener ---
export function ShortcutsInitializer() {
  useRegisterDefaultShortcuts();
  return null;
}

export function KeyboardShortcutListener() {
  const { shortcuts, showModal, setShowModal } = useKeyboardShortcuts();
  const [heldKeys, setHeldKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        if (e.key === 'Escape' && showModal) {
          setShowModal(false);
          return;
        }
        if (e.key === '?') {
          setShowModal((prev) => !prev);
          return;
        }
        return;
      }

      const key = e.key.toLowerCase();
      const newHeld = new Set(heldKeys);
      newHeld.add(key);

      if (key === 'escape' && showModal) {
        setShowModal(false);
        setHeldKeys(new Set());
        return;
      }

      if (key === '?') {
        setShowModal((prev) => !prev);
        setHeldKeys(new Set());
        return;
      }

      const combo = Array.from(newHeld).sort().join(' ');
      for (const s of shortcuts) {
        const expectedKeys = s.keys.split(' ').sort().join(' ');
        if (combo === expectedKeys) {
          e.preventDefault();
          s.handler();
          setHeldKeys(new Set());
          return;
        }
      }

      setHeldKeys(newHeld);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const newHeld = new Set(heldKeys);
      newHeld.delete(e.key.toLowerCase());
      setHeldKeys(newHeld);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [shortcuts, heldKeys, showModal, setShowModal]);

  return null;
}

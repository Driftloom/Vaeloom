import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

interface Modal {
  id: string;
  type: string;
  data?: Record<string, unknown>;
}

interface UiState {
  sidebarOpen: boolean;
  theme: Theme;
  toasts: Toast[];
  modals: Modal[];
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (t: Theme) => void;
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  openModal: (type: string, data?: Record<string, unknown>) => string;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
}

let toastCounter = 0;
let modalCounter = 0;

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  theme: 'dark',
  toasts: [],
  modals: [],

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setTheme: (theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
      localStorage.setItem('theme', theme);
    }
    set({ theme });
  },

  addToast: (toast) => {
    const id = `toast-${++toastCounter}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
    return id;
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  openModal: (type, data) => {
    const id = `modal-${++modalCounter}`;
    set((s) => ({ modals: [...s.modals, { id, type, data }] }));
    return id;
  },

  closeModal: (id) => set((s) => ({ modals: s.modals.filter((m) => m.id !== id) })),
  closeAllModals: () => set({ modals: [] }),
}));

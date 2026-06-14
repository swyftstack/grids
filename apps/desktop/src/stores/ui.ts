import { create } from 'zustand';
import type { MouseEvent, ReactNode } from 'react';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'danger' | 'default';
  /** Extra detail rendered in a monospace block (e.g. the SQL to be run). */
  detail?: string;
  /** When set, the user must type this exact phrase to enable the confirm button (Safe Delete). */
  confirmPhrase?: string;
  /** Optional list of dependencies/affected objects shown above the actions. */
  dependencies?: string[];
  onConfirm: () => void;
}

export interface Toast {
  id: string;
  message: string;
  tone: 'success' | 'error' | 'info';
}

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Render a separator above this item. */
  separator?: boolean;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

interface UiState {
  commandPaletteOpen: boolean;
  searchOpen: boolean;
  confirm: ConfirmRequest | null;
  toasts: Toast[];
  contextMenu: ContextMenuState | null;

  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  openSearch: () => void;
  closeSearch: () => void;

  requestConfirm: (req: ConfirmRequest) => void;
  resolveConfirm: () => void;

  openContextMenu: (e: MouseEvent, items: ContextMenuItem[]) => void;
  closeContextMenu: () => void;

  pushToast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
}

export const useUi = create<UiState>((set, get) => ({
  commandPaletteOpen: false,
  searchOpen: false,
  confirm: null,
  toasts: [],
  contextMenu: null,

  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),

  requestConfirm: (req) => set({ confirm: req }),
  resolveConfirm: () => set({ confirm: null }),

  openContextMenu: (e, items) => {
    e.preventDefault();
    e.stopPropagation();
    set({ contextMenu: { x: e.clientX, y: e.clientY, items } });
  },
  closeContextMenu: () => set({ contextMenu: null }),

  pushToast: (message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => get().dismissToast(id), 4000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'muted';

export interface ToastOptions {
  duration?: number;
  onPress?: () => void;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  onPress?: () => void;
}

interface ToastStore {
  toasts: ToastItem[];
  showToast: (type: ToastType, message: string, title?: string, options?: ToastOptions) => string;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  showToast: (type, message, title, options) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, title, onPress: options?.onPress }],
    }));

    const duration = options?.duration ?? 3000;
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== id),
        }));
      }, duration);
    }

    return id;
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
}));

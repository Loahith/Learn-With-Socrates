import { create } from "zustand";

export const useToast = create((set) => ({
  toasts: [],
  push: (type, message) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m) => useToast.getState().push("success", m),
  error: (m) => useToast.getState().push("error", m),
  info: (m) => useToast.getState().push("info", m),
};

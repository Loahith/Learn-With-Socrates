import { create } from "zustand";

const KEY = "learn-with-socrates-auth";
const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || localStorage.getItem("socraticai-auth")) || {};
  } catch {
    return {};
  }
};

export const useAuth = create((set) => ({
  token: load().token || null,
  user: load().user || null,
  setAuth: (token, user) => {
    localStorage.setItem(KEY, JSON.stringify({ token, user }));
    set({ token, user });
  },
  setUser: (user) =>
    set((s) => {
      localStorage.setItem(KEY, JSON.stringify({ token: s.token, user }));
      return { user };
    }),
  clear: () => {
    localStorage.removeItem(KEY);
    set({ token: null, user: null });
  },
}));

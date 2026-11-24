import axios from "axios";
import { useAuth } from "@/store/auth";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api" });

api.interceptors.request.use((cfg) => {
  const token = useAuth.getState().token;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const url = err.config?.url || "";
    if (err.response?.status === 401 && useAuth.getState().token && !url.includes("/auth/login")) {
      useAuth.getState().clear(); // session expired -> ProtectedRoute redirects to /login
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e, fallback = "Something went wrong.") =>
  e?.response?.data?.error ||
  (e?.code === "ERR_NETWORK" ? "Cannot reach the server. Is the backend running on port 5000?" : fallback);

export default api;

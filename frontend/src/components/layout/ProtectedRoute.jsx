import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/store/auth";

export default function ProtectedRoute() {
  const token = useAuth((s) => s.token);
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

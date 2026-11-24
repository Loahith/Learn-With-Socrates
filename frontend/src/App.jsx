import { useState, useEffect } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { WifiOff } from "lucide-react";
import PublicLayout from "@/components/layout/PublicLayout";
import StudentLayout from "@/components/layout/StudentLayout";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { Toaster } from "@/components/ui/misc";
import Landing from "@/pages/Landing";
import { Login, Register, ForgotPassword, ResetPassword } from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Resources from "@/pages/Resources";
import Workspace from "@/pages/Workspace";
import Bloom from "@/pages/Bloom";
import Chat from "@/pages/Chat";
import Assessments from "@/pages/Assessments";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import Offline from "@/pages/Offline";

export default function App() {
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== "undefined" ? !navigator.onLine : false));

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/offline" element={<Offline />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<StudentLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/workspace" element={<Workspace />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/bloom" element={<Bloom />} />
            <Route path="/assessments" element={<Assessments />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Floating Offline Notification Banner */}
      {isOffline && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 shadow-xl text-amber-900 text-xs sm:text-sm animate-in slide-in-from-bottom duration-300 max-w-[92vw]"
        >
          <WifiOff size={18} className="text-amber-600 shrink-0" />
          <span className="font-medium">No internet connection.</span>
          <Link to="/offline">
            <button className="rounded-xl bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-700 transition cursor-pointer">
              Play Socrates Runner
            </button>
          </Link>
        </aside>
      )}

      <Toaster />
    </>
  );
}

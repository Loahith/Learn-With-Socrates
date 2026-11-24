import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import api from "@/lib/api";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/utils";

export default function StudentLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const setUser = useAuth((s) => s.setUser);

  useEffect(() => {
    api.get("/auth/profile").then((r) => setUser(r.data.user)).catch(() => {});
  }, [setUser]);

  const wide = pathname.startsWith("/workspace") || pathname.startsWith("/chat");
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 w-full max-w-full flex-col lg:pl-64">
        <Navbar onMenu={() => setOpen(true)} />
        <main className={cn("w-full max-w-full min-w-0 mx-auto p-4 md:p-6", wide ? "max-w-none" : "max-w-6xl md:p-8")}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

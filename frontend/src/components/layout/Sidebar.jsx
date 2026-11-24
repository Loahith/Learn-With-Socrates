import { NavLink } from "react-router-dom";
import { LayoutDashboard, FolderOpen, MessagesSquare, Layers, Mic, ClipboardCheck, BarChart3, Settings, Sparkles, X } from "lucide-react";
import Logo from "@/components/Logo";
import { cn } from "@/lib/utils";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/resources", label: "My Resources", icon: FolderOpen },
  { to: "/chat", label: "Ask Socrates (Voice)", icon: Mic },
  { to: "/workspace", label: "Learning Workspace", icon: MessagesSquare },
  { to: "/bloom", label: "Bloom's Taxonomy", icon: Layers },
  { to: "/assessments", label: "Assessments", icon: ClipboardCheck },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ open, onClose }) {
  return (
    <>
      <div
        onClick={onClose}
        className={cn("fixed inset-0 z-30 bg-black/40 transition-opacity lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-forest p-4 transition-transform lg:translate-x-0 lg:visible",
          open ? "translate-x-0 visible" : "-translate-x-full invisible"
        )}
      >
        <div className="flex items-center justify-between px-2 pb-6 pt-2">
          <Logo light to="/dashboard" />
          <button onClick={onClose} className="text-white/70 lg:hidden" aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-brand text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-3 text-white">
          <Sparkles size={20} className="mt-0.5 shrink-0 text-gold" />
          <div>
            <p className="text-sm font-semibold">Tip</p>
            <p className="text-xs text-white/60">Switch between Socratic and Direct mode anytime. Your progress stays.</p>
          </div>
        </div>
      </aside>
    </>
  );
}

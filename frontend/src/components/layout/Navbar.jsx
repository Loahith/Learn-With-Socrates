import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Menu, Search, Bell, LogOut, Settings } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/store/auth";
import { timeAgo, cn } from "@/lib/utils";

function useOutside(ref, fn) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && fn();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, fn]);
}

export default function Navbar({ onMenu }) {
  const navigate = useNavigate();
  const { user, clear } = useAuth();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  const [notes, setNotes] = useState({ notifications: [], unread: 0 });
  const menuRef = useRef(null);
  const bellRef = useRef(null);
  useOutside(menuRef, () => setMenu(false));
  useOutside(bellRef, () => setBell(false));

  const loadNotes = () => api.get("/notifications").then((r) => setNotes(r.data)).catch(() => {});
  useEffect(() => {
    loadNotes();
    const t = setInterval(loadNotes, 60000);
    return () => clearInterval(t);
  }, []);

  const openBell = () => {
    setBell((b) => !b);
    setMenu(false);
    if (notes.unread) api.post("/notifications/read").then(() => setNotes((n) => ({ ...n, unread: 0 }))).catch(() => {});
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    clear();
    navigate("/");
  };

  const initial = (user?.name || "?").trim()[0]?.toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex w-full max-w-full items-center gap-2 sm:gap-3 border-b border-line bg-ivory/90 px-3 sm:px-4 py-2.5 sm:py-3 backdrop-blur md:px-8">
      <button onClick={onMenu} className="shrink-0 rounded-lg p-2 text-forest hover:bg-black/5 lg:hidden" aria-label="Open menu">
        <Menu size={22} />
      </button>

      <form
        className="flex min-w-0 flex-1 max-w-md items-center gap-2 rounded-xl border border-line bg-white px-3 py-1.5 sm:py-2 text-grey"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(`/resources?q=${encodeURIComponent(q)}`);
        }}
      >
        <Search size={16} className="shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search resources..." className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-grey" />
      </form>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className="relative" ref={bellRef}>
          <button onClick={openBell} className="relative rounded-full p-2 text-grey hover:bg-black/5" aria-label="Notifications">
            <Bell size={20} />
            {notes.unread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-ivory" />}
          </button>
          {bell && (
            <div className="absolute right-0 mt-2 w-80 max-w-[85vw] rounded-2xl border border-line bg-white p-2 shadow-lg">
              <p className="px-3 py-2 text-sm font-bold">Notifications</p>
              {notes.notifications.length === 0 && <p className="px-3 py-4 text-sm text-grey">Nothing yet.</p>}
              <div className="max-h-80 overflow-y-auto">
                {notes.notifications.map((n) => (
                  <div key={n.id} className="rounded-xl px-3 py-2 hover:bg-ivory">
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="text-xs text-grey">{n.message}</p>
                    <p className="mt-0.5 text-[11px] text-grey/80">{timeAgo(n.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => { setMenu((m) => !m); setBell(false); }}
            className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sage font-display font-bold text-forest ring-2 ring-forest/15 transition-all hover:ring-brand/40"
            aria-label="Account menu"
          >
            {user?.profile?.avatar_url ? (
              <img src={user.profile.avatar_url} alt={user?.name || "User"} className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </button>
          {menu && (
            <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-line bg-white p-2 shadow-lg">
              <div className="flex items-center gap-3 border-b border-line px-3 py-2.5 mb-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sage font-display font-bold text-forest">
                  {user?.profile?.avatar_url ? (
                    <img src={user.profile.avatar_url} alt={user?.name || "User"} className="h-full w-full object-cover" />
                  ) : (
                    initial
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-forest">{user?.name}</p>
                  <p className="truncate text-xs text-grey">{user?.email}</p>
                </div>
              </div>
              <Link to="/settings" onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-ivory">
                <Settings size={16} /> Settings
              </Link>
              <button onClick={logout} className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50")}>
                <LogOut size={16} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

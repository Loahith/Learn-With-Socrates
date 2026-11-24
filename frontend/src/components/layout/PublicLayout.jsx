import { Outlet, Link } from "react-router-dom";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";

export default function PublicLayout() {
  const token = useAuth((s) => s.token);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-ivory/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-grey md:flex">
            <a href="#features" className="hover:text-forest">Features</a>
            <a href="#how" className="hover:text-forest">How it works</a>
            <a href="#modes" className="hover:text-forest">Teaching modes</a>
            <a href="#bloom" className="hover:text-forest">Bloom's Taxonomy</a>
          </nav>
          <div className="flex items-center gap-2">
            {token ? (
              <Link to="/dashboard"><Button size="sm">Open Dashboard</Button></Link>
            ) : (
              <>
                <Link to="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
                <Link to="/register"><Button size="sm">Get Started</Button></Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-grey md:flex-row md:px-8">
          <Logo />
          <p>© {new Date().getFullYear()} Learn with Socrates. Learn smarter. Think deeper.</p>
        </div>
      </footer>
    </div>
  );
}

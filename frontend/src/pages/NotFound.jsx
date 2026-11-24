import { useState } from "react";
import { Link } from "react-router-dom";
import { Home, Sparkles, Gamepad2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Statue from "@/components/Statue";
import SocratesRunner from "@/components/SocratesRunner";

export default function NotFound() {
  const [showGame, setShowGame] = useState(false);

  return (
    <div className="min-h-screen bg-ivory flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Top Header */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between pb-4">
        <Link to="/" className="flex items-center gap-2 text-forest font-display font-extrabold text-base sm:text-lg">
          <span className="h-8 w-8 rounded-full bg-forest text-white flex items-center justify-center text-sm font-bold">
            S
          </span>
          Learn with Socrates
        </Link>

        <div className="flex items-center gap-2">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <Home size={15} /> Go Home
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto w-full my-auto flex flex-col items-center">
        {!showGame ? (
          <div className="flex flex-col items-center text-center max-w-lg">
            <Statue className="h-36 sm:h-44 w-auto drop-shadow-lg mb-2" />
            <p className="font-display text-6xl sm:text-7xl font-extrabold text-brand tracking-tight">404</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-forest mt-1">Page not found</h1>
            <p className="text-sm sm:text-base text-grey mt-2 leading-relaxed">
              “I know that I know nothing”, and this page is not here either.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link to="/">
                <Button className="gap-2">
                  <Home size={16} /> Return to Home
                </Button>
              </Link>
              <Button
                variant="outline"
                className="gap-2 border-brand/30 text-forest hover:bg-brand/10 hover:border-brand"
                onClick={() => setShowGame(true)}
              >
                <Gamepad2 size={16} className="text-brand" /> Play Socrates Runner
              </Button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-3xl flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-3 px-1">
              <div>
                <h2 className="text-lg font-bold text-forest">Socrates Runner</h2>
                <p className="text-xs text-grey">Contemplate philosophy and dodge ancient obstacles</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setShowGame(false)}
              >
                <ArrowLeft size={14} /> Back to 404
              </Button>
            </div>

            <SocratesRunner />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-4xl mx-auto w-full pt-6 text-center text-xs text-grey">
        <p>© {new Date().getFullYear()} Learn with Socrates. Learn smarter. Think deeper.</p>
      </div>
    </div>
  );
}

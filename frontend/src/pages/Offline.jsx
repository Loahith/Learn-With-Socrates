import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { WifiOff, RefreshCw, Home, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import SocratesRunner from "@/components/SocratesRunner";

export default function Offline() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [checking, setChecking] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setStatusMsg("Connection restored! You are back online.");
    };
    const handleOffline = () => {
      setIsOnline(false);
      setStatusMsg("Internet connection lost.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const checkConnection = async () => {
    setChecking(true);
    setStatusMsg(null);
    try {
      // Try fetching a lightweight resource or ping
      const res = await fetch("/favicon.ico?t=" + Date.now(), { method: "HEAD", cache: "no-store" });
      if (res.ok) {
        setIsOnline(true);
        setStatusMsg("Connection verified! You are back online.");
      } else {
        setIsOnline(false);
        setStatusMsg("Still offline. Please check your network.");
      }
    } catch {
      setIsOnline(false);
      setStatusMsg("Still offline. Please check your network.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-ivory flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Header */}
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
              <Home size={15} /> Home
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto w-full my-auto flex flex-col items-center">
        {/* Offline Banner Card */}
        <div className="w-full max-w-3xl mb-6">
          <div className="flex items-start gap-3.5 rounded-2xl border border-line bg-white/80 p-4 sm:p-5 shadow-card">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
              <WifiOff size={22} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-forest">
                  No Internet Connection
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  <WifiOff size={12} /> Disconnected
                </span>
              </div>

              <p className="mt-1 text-xs sm:text-sm text-grey leading-relaxed">
                You appear to be offline. Try checking your network cables, modem, or Wi-Fi connection.
              </p>

              {statusMsg && (
                <div
                  className={`mt-2.5 flex items-center gap-1.5 text-xs font-semibold ${
                    isOnline ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {isOnline ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  <span>{statusMsg}</span>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={checkConnection}
                  disabled={checking}
                >
                  <RefreshCw size={13} className={checking ? "animate-spin" : ""} />
                  {checking ? "Checking..." : "Check Connection"}
                </Button>

                {isOnline && (
                  <Button size="sm" className="gap-1.5" onClick={() => navigate("/dashboard")}>
                    Return to Dashboard
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* The Interactive Socrates Dino Runner Game */}
        <div className="w-full max-w-3xl">
          <div className="mb-2 flex items-center justify-between px-2">
            <p className="text-xs font-semibold text-grey">
              Contemplate with Socrates while waiting —{" "}
              <span className="hidden sm:inline">
                press <strong className="text-forest">Space</strong> to jump!
              </span>
              <span className="inline sm:hidden">
                <strong className="text-forest">Tap screen</strong> to jump!
              </span>
            </p>
          </div>

          <SocratesRunner />
        </div>
      </div>

      {/* Footer info */}
      <div className="max-w-4xl mx-auto w-full pt-6 text-center text-xs text-grey">
        <p>“The secret of change is to focus all of your energy not on fighting the old, but on building the new.” — Socrates</p>
      </div>
    </div>
  );
}

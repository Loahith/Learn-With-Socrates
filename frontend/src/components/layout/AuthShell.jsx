import { Link } from "react-router-dom";
import { Quote } from "lucide-react";
import Logo from "@/components/Logo";
import Statue from "@/components/Statue";

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-forest p-10 text-white lg:flex">
        <Statue className="absolute -bottom-4 -right-16 w-[30rem] max-w-none opacity-90" />
        <Logo light />
        <div className="relative max-w-sm">
          <Quote className="mb-4 text-gold" size={32} />
          <p className="font-display text-3xl font-bold leading-snug text-white">
            “The only true wisdom is in knowing you know nothing.”
          </p>
          <p className="mt-3 text-white/60">Socrates. Great learning begins with great questions.</p>
        </div>
        <p className="relative text-sm text-white/50">Learn Smarter. Think Deeper.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-3xl font-extrabold">{title}</h1>
          <p className="mb-6 mt-1 text-grey">{subtitle}</p>
          {children}
          <div className="mt-6 text-center text-sm text-grey">{footer}</div>
          <p className="mt-8 text-center text-xs text-grey"><Link to="/" className="hover:text-forest">← Back to home</Link></p>
        </div>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import socratesLogoWhite from "@/assets/socrates-logo.png";
import socratesLogoForest from "@/assets/socrates-logo-forest.png";
import { cn } from "@/lib/utils";

export default function Logo({ light = false, to = "/" }) {
  return (
    <Link to={to} className="group flex items-center gap-2.5">
      <img
        src={light ? socratesLogoWhite : socratesLogoForest}
        alt="Socrates"
        className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 object-contain transition-transform group-hover:scale-105"
        draggable={false}
      />
      <span className={cn("font-display text-base sm:text-lg font-extrabold tracking-tight leading-tight", light ? "text-white" : "text-forest")}>
        Learn with Socrates
      </span>
    </Link>
  );
}

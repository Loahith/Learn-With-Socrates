import statue from "@/assets/socrates.webp";
import { cn } from "@/lib/utils";

/** Transparent-background statue image. Use className for size/position. */
export default function Statue({ className, flip = false, ...props }) {
  return (
    <img
      src={statue}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("pointer-events-none select-none", flip && "-scale-x-100", className)}
      {...props}
    />
  );
}

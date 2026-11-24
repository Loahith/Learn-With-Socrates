import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none transition placeholder:text-grey/70 focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60";

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(base, "h-11", className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(base, "py-2.5", className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(base, "h-11 cursor-pointer", className)} {...props}>
      {children}
    </select>
  );
});

export function Field({ label, error, hint, children, className }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      {label && <span className="text-sm font-semibold text-forest">{label}</span>}
      {children}
      {hint && !error && <span className="block text-xs text-grey">{hint}</span>}
      {error && <span className="block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

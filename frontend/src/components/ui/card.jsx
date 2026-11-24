import { cn } from "@/lib/utils";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn("min-w-0 rounded-2xl border border-line bg-white shadow-card", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("px-5 pt-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn("text-base font-bold", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("p-5", className)} {...props} />;
}

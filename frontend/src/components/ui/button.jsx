import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-brand text-white shadow-sm hover:bg-brand-dark",
        outline: "border border-line bg-white text-forest hover:bg-ivory",
        soft: "bg-brand/10 text-brand hover:bg-brand/15",
        ghost: "text-grey hover:bg-black/5 hover:text-forest",
        gold: "bg-gold text-forest hover:brightness-95",
      },
      size: {
        sm: "h-9 px-3",
        default: "h-11 px-5",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export function Button({ className, variant, size, ...props }) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };

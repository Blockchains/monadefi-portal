import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-[transform,opacity,background-color] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:opacity-90",
        secondary: "border border-border bg-bg-elev text-fg hover:bg-bg-subtle",
        ghost: "text-muted hover:bg-bg-subtle hover:text-fg",
      },
      size: {
        md: "h-11",
        sm: "h-9 px-3",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

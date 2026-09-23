import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-glow-violet hover:-translate-y-0.5 hover:bg-primary-bright",
        cyan: "bg-cyan text-cyan-foreground shadow-glow-cyan hover:-translate-y-0.5 hover:bg-cyan-bright",
        glass: "border border-border bg-surface/70 text-foreground backdrop-blur-xl hover:border-border-bright hover:bg-surface-bright",
        ghost: "text-muted-foreground hover:bg-surface hover:text-foreground",
        icon: "size-10 border border-border bg-surface/70 p-0 text-muted-foreground hover:border-border-bright hover:text-foreground",
      },
      size: {
        sm: "h-8 rounded-lg px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-5 text-sm",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

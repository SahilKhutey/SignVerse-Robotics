import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-accent-cyan/10 text-accent-cyan shadow-[0_0_8px_rgba(0,240,255,0.15)]",
        secondary:
          "border-transparent bg-white/5 text-text-secondary hover:bg-white/10",
        destructive:
          "border-transparent bg-accent-red/10 text-accent-red shadow-[0_0_8px_rgba(255,51,102,0.15)]",
        outline: "text-text-primary border-sv-border",
        success: 
          "border-transparent bg-accent-green/10 text-accent-green shadow-[0_0_8px_rgba(57,255,20,0.15)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

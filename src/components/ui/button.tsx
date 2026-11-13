import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "ui-button inline-flex max-w-full min-w-0 items-center justify-center gap-2 whitespace-normal rounded-lg text-sm font-semibold leading-snug text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-none disabled:bg-muted disabled:text-muted-foreground disabled:border-border disabled:shadow-none disabled:brightness-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "gradient-accent text-primary-foreground hover:brightness-110 transition-all",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-strong bg-card text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground hover:border-accent-primary active:bg-accent/80",
        secondary: "border-2 border-accent-primary/45 bg-card text-foreground shadow-sm hover:bg-accent-primary/10 hover:border-accent-primary active:bg-accent-primary/15",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "gradient-text underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-4 py-2.5",
        sm: "min-h-10 px-3 py-2 text-sm",
        lg: "min-h-12 px-5 py-3 text-base",
        icon: "h-11 w-11 shrink-0 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

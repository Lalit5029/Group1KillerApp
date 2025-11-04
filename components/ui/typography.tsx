import React from "react";
import { cn } from "@/lib/utils";

interface TypographyProps {
  variant?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "subtitle" | "body" | "caption";
  className?: string;
  children: React.ReactNode;
}

const variantClassNames = {
  h1: "text-4xl font-bold tracking-tight",
  h2: "text-3xl font-bold tracking-tight",
  h3: "text-2xl font-semibold",
  h4: "text-xl font-semibold",
  h5: "text-lg font-semibold",
  h6: "text-base font-semibold",
  subtitle: "text-base font-medium",
  body: "text-base",
  caption: "text-sm text-muted-foreground",
};

const Typography = React.forwardRef<
  HTMLParagraphElement,
  TypographyProps & React.HTMLAttributes<HTMLParagraphElement>
>(({ variant = "body", className, children, ...props }, ref) => {
  const Element = variant.startsWith("h") ? variant : "p";
  
  return React.createElement(
    Element,
    {
      ref,
      className: cn(variantClassNames[variant], className),
      ...props,
    },
    children
  );
});

Typography.displayName = "Typography";

export { Typography }; 
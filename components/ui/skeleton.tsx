import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Base skeleton primitive. A muted, rounded block that pulses only when the
// user has not requested reduced motion (`motion-safe:` maps to
// prefers-reduced-motion: no-preference). It is decorative, so it is hidden
// from assistive tech — the surrounding loading region carries the
// role="status"/aria-busy semantics.
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("rounded-md bg-muted motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Fades a section up the first time it enters the viewport, then stops
// observing. The hidden state is applied from JavaScript rather than in the
// markup, so with JavaScript off — or before hydration — the content is simply
// visible. `prefers-reduced-motion` is honoured by the CSS.
export function Reveal({
  children,
  className,
  delayMs = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  as?: "div" | "section" | "li";
}) {
  const ref = React.useRef<HTMLElement | null>(null);
  const [state, setState] = React.useState<"idle" | "ready" | "in">("idle");

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setState("in");
      return;
    }
    // Anything already on screen at mount skips straight to visible, so the
    // top of the page never sits blank waiting for a scroll.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) {
      setState("in");
      return;
    }
    setState("ready");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setState("in");
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={cn(state === "ready" && "reveal-ready", state === "in" && "reveal-in", className)}
      style={state === "in" && delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

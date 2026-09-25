"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// The weekend page's shared view of its market cards. Each card reports
// whether it holds a call and whether leaving now could lose work; from that
// the provider draws the calls-made meter and guards navigation.
//
// The guard asks only while something is actually pending — a save in
// flight, one that failed, or a saved call cleared back to incomplete — which
// autosave keeps to a second or two. `beforeunload` covers reload, close and
// external links. In-app links go through the router, which fires no
// `beforeunload`, and the site nav lives outside this page, so one
// capture-phase click listener checks every same-origin link instead.

type CardReport = { called: boolean; counted: boolean; pending: boolean };

type PendingPicksContextValue = {
  report: (marketId: string, report: CardReport) => void;
  progress: { called: number; callable: number } | null;
};

const PendingPicksContext = React.createContext<PendingPicksContextValue | null>(null);

export function PendingPicksProvider({
  confirmLeave,
  children,
}: {
  // Shown in the confirm dialog before an in-app navigation.
  confirmLeave: string;
  children: React.ReactNode;
}) {
  const [cards, setCards] = React.useState<Record<string, CardReport>>({});

  const report = React.useCallback((marketId: string, next: CardReport) => {
    setCards((prev) => {
      const cur = prev[marketId];
      if (
        cur &&
        cur.called === next.called &&
        cur.counted === next.counted &&
        cur.pending === next.pending
      ) {
        return prev;
      }
      return { ...prev, [marketId]: next };
    });
  }, []);

  const values = Object.values(cards);
  const pending = values.some((c) => c.pending);
  const reported = values.length > 0;
  const called = values.filter((c) => c.counted && c.called).length;
  const callable = values.filter((c) => c.counted).length;

  React.useEffect(() => {
    if (!pending) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Older browsers still need returnValue set to show the prompt.
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return; // beforeunload handles it
      const here = window.location;
      if (url.pathname === here.pathname && url.search === here.search) return; // hash link
      if (!window.confirm(confirmLeave)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [pending, confirmLeave]);

  const value = React.useMemo(
    () => ({ report, progress: reported ? { called, callable } : null }),
    [report, reported, called, callable],
  );
  return <PendingPicksContext.Provider value={value}>{children}</PendingPicksContext.Provider>;
}

// A card tells the page what it holds. A no-op outside a provider, so the
// card still renders on its own (tests, stories).
export function useReportCard(marketId: string, report: CardReport): void {
  const ctx = React.useContext(PendingPicksContext);
  const { called, counted, pending } = report;
  React.useEffect(() => {
    ctx?.report(marketId, { called, counted, pending });
  }, [ctx, marketId, called, counted, pending]);
}

// "4/6 calls made" with a meter. Renders the server's count until the cards
// have reported, so the first paint already shows the right number.
export function PickProgressMeter({
  initial,
  labelTemplate,
  className,
}: {
  initial: { called: number; callable: number };
  // Accessible label with {called} and {callable} placeholders, e.g. from
  // `t.raw()`; a server component cannot hand a formatter to the client.
  labelTemplate: string;
  className?: string;
}) {
  const ctx = React.useContext(PendingPicksContext);
  const { called, callable } = ctx?.progress ?? initial;
  if (callable === 0) return null;
  const text = labelTemplate
    .replace("{called}", String(called))
    .replace("{callable}", String(callable));
  return <ProgressBar called={called} callable={callable} text={text} className={className} />;
}

export function ProgressBar({
  called,
  callable,
  text,
  urgent = false,
  compact = false,
  className,
}: {
  called: number;
  callable: number;
  text: string;
  urgent?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const done = callable > 0 && called >= callable;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={callable}
        aria-valuenow={called}
        aria-label={text}
        className={cn(
          "relative h-1.5 overflow-hidden rounded-full bg-muted",
          compact ? "w-12" : "w-24",
        )}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-300",
            urgent ? "bg-flag" : done ? "bg-signal" : "bg-foreground/70",
          )}
          style={{ width: `${callable === 0 ? 0 : (called / callable) * 100}%` }}
        />
      </div>
      <span
        aria-hidden
        className={cn(
          "font-mono tabular-nums",
          compact ? "text-[11px]" : "text-xs",
          urgent ? "font-semibold text-flag" : "text-muted-foreground",
        )}
      >
        {called}/{callable}
      </span>
    </div>
  );
}

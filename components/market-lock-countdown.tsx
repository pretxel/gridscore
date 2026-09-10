"use client";

import * as React from "react";
import { LOCK_LEAD_WINDOW_MS } from "@/lib/market-utils";
import { cn } from "@/lib/utils";

type Units = { days: string; hours: string; mins: string; secs: string };

// One-second ticker to a market's locks_at. Far out it reads "2d 05h 12m";
// inside the lead window it turns to the flag accent and reads "closes in
// 12:30"; at zero it swaps to the locked label. Purely cosmetic: the database
// decides the lock.
export function MarketLockCountdown({
  locksAt,
  units,
  closesInTemplate,
  lockedLabel,
  leadWindowMs = LOCK_LEAD_WINDOW_MS,
  className,
  onLocked,
}: {
  locksAt: string;
  units: Units;
  closesInTemplate: string;
  lockedLabel: string;
  leadWindowMs?: number;
  className?: string;
  onLocked?: () => void;
}) {
  const [remaining, setRemaining] = React.useState<number>(() =>
    Math.max(0, Date.parse(locksAt) - Date.now()),
  );
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    const target = Date.parse(locksAt);
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    if (target - Date.now() <= 0) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [locksAt]);

  React.useEffect(() => {
    if (remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      onLocked?.();
    }
  }, [remaining, onLocked]);

  if (remaining <= 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground",
          className,
        )}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground/60" />
        {lockedLabel}
      </span>
    );
  }

  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1_000);
  const soon = remaining <= leadWindowMs;

  const text = soon
    ? closesInTemplate.replace("{time}", `${pad(mins + hours * 60)}:${pad(secs)}`)
    : days > 0
      ? `${days}${units.days} ${pad(hours)}${units.hours} ${pad(mins)}${units.mins}`
      : `${pad(hours)}${units.hours} ${pad(mins)}${units.mins} ${pad(secs)}${units.secs}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em]",
        soon ? "text-flag" : "text-muted-foreground",
        className,
      )}
      aria-live="polite"
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", soon ? "bg-flag" : "bg-signal")} />
      {text}
    </span>
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

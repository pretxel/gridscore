"use client";

import * as React from "react";
import { LocalTime } from "@/components/local-time";
import { type SessionKey, type SessionPhase, sessionPhase } from "@/lib/sessions";
import { cn } from "@/lib/utils";

// One row of the weekend timetable.
//
// A session becomes live while the page is open, so this ticks rather than
// freezing whatever the server believed at render. The first client render
// reuses the server's clock so hydration matches; the interval takes over from
// there. A minute is fine: nothing here counts seconds.
const TICK_MS = 15_000;

export function SessionRow({
  session,
  label,
  liveLabel,
  now,
}: {
  session: { key: SessionKey; at: string };
  label: string;
  liveLabel: string;
  now: number;
}) {
  const [phase, setPhase] = React.useState<SessionPhase>(() => sessionPhase(session, now));

  React.useEffect(() => {
    const tick = () => setPhase(sessionPhase(session, Date.now()));
    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [session]);

  // Qualifying, the sprint and the race are the sessions a call rides on.
  const decisive =
    session.key === "race" || session.key === "qualifying" || session.key === "sprint";
  const live = phase === "live";

  return (
    <li
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5 text-sm",
        phase === "past" && "text-muted-foreground",
        live && "bg-live/5",
      )}
    >
      <span className={cn("flex min-w-0 items-center gap-2", decisive && "font-medium")}>
        {live ? (
          // The pulsing ring stands in for the status dot: one live session at a
          // time, so the motion never competes with itself. It holds still under
          // prefers-reduced-motion.
          <span aria-hidden className="live-pulse" />
        ) : (
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              phase === "past" ? "bg-muted-foreground/40" : decisive ? "bg-signal" : "bg-border",
            )}
          />
        )}
        <span className="truncate">{label}</span>
      </span>
      {live ? (
        <span
          className="shrink-0 rounded-md bg-live/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-live"
          aria-live="polite"
        >
          {liveLabel}
        </span>
      ) : (
        <span className="shrink-0 font-mono text-xs tabular-nums">
          <LocalTime iso={session.at} format="datetime" />
        </span>
      )}
    </li>
  );
}

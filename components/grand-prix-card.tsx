import { ChevronRightIcon, MapPinIcon, ZapIcon } from "lucide-react";
import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import type { GrandPrixRow } from "@/lib/db";
import type { GrandPrixPhase } from "@/lib/market-utils";
import { cn } from "@/lib/utils";

export type GrandPrixCardLabels = {
  round: string;
  sprint: string;
  multiplier: string;
  multiplierReason: string;
  phase: string;
  calls: string | null;
  open: string;
};

const PHASE_CLASS: Record<GrandPrixPhase, string> = {
  upcoming: "bg-secondary text-secondary-foreground ring-1 ring-inset ring-border",
  weekend: "bg-signal text-signal-foreground ring-1 ring-inset ring-signal/50 live-pulse",
  completed: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  cancelled: "bg-muted text-muted-foreground line-through ring-1 ring-inset ring-border",
};

// One calendar row. `highlight` marks the weekend the visitor should open
// first. Presentational; the page computes phase and call counts.
export function GrandPrixCard({
  grandPrix,
  href,
  phase,
  labels,
  highlight = false,
  className,
}: {
  grandPrix: GrandPrixRow;
  href: string;
  phase: GrandPrixPhase;
  labels: GrandPrixCardLabels;
  highlight?: boolean;
  className?: string;
}) {
  const place = [grandPrix.locality, grandPrix.country].filter(Boolean).join(", ");
  return (
    <Link
      href={href}
      className={cn(
        "group/gp block rounded-xl border bg-card p-4 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50",
        highlight ? "border-signal/60 shadow-[0_0_0_1px_var(--signal)]" : "border-border",
        phase === "completed" && "opacity-80",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {labels.round}
          </p>
          <h3 className="mt-0.5 truncate font-heading text-lg font-semibold tracking-tight sm:text-xl">
            {grandPrix.name}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
            <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {grandPrix.circuit_name}
              {place ? ` · ${place}` : ""}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em]",
              PHASE_CLASS[phase],
            )}
          >
            {labels.phase}
          </span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            <LocalTime iso={grandPrix.race_at} format="date" />
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span
          title={labels.multiplierReason}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono font-semibold tracking-[0.1em]",
            Number(grandPrix.multiplier) > 1
              ? "bg-flag/15 text-flag-foreground ring-1 ring-inset ring-flag/40 dark:text-flag"
              : "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
          )}
        >
          <ZapIcon className="size-3" aria-hidden />
          {labels.multiplier}
        </span>
        {grandPrix.has_sprint ? (
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono uppercase tracking-[0.12em] text-muted-foreground ring-1 ring-inset ring-border">
            {labels.sprint}
          </span>
        ) : null}
        {labels.calls ? (
          <span className="ml-auto text-muted-foreground">{labels.calls}</span>
        ) : null}
        <span className="inline-flex items-center gap-0.5 font-medium text-foreground transition-transform group-hover/gp:translate-x-0.5">
          {labels.open}
          <ChevronRightIcon className="size-3.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

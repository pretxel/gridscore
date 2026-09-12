"use client";

import { CheckIcon, Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { MarketLockCountdown } from "@/components/market-lock-countdown";
import { MarketStatusBadge } from "@/components/market-status-badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { HitType } from "@/lib/db";
import { type DriverOption, driverLabel } from "@/lib/driver-format";
import { lockReason } from "@/lib/market-utils";
import {
  MARKET_LOCK_SESSION,
  type MarketPick,
  type MarketStatus,
  type MarketType,
} from "@/lib/markets";
import { formatPick } from "@/lib/pick-format";
import { cn } from "@/lib/utils";
import { submitPick } from "./actions";

export type MarketFormMarket = {
  id: string;
  type: MarketType;
  locksAt: string;
  status: MarketStatus;
  result: MarketPick | null;
};

type DriverState = { driver_id: string | "" };
type RetireState = { driver_id: string | "" | "none" };
type SafetyState = { value: boolean | null };
type PodiumState = { p1: string; p2: string; p3: string };

function initialState(type: MarketType, initial: MarketPick | null): unknown {
  switch (type) {
    case "podium":
      return (initial as PodiumState | null) ?? { p1: "", p2: "", p3: "" };
    case "safety_car":
      return { value: (initial as SafetyState | null)?.value ?? null };
    case "first_retirement": {
      if (!initial) return { driver_id: "" };
      const id = (initial as { driver_id: string | null }).driver_id;
      return { driver_id: id ?? "none" };
    }
    default:
      return { driver_id: (initial as DriverState | null)?.driver_id ?? "" };
  }
}

function toPick(type: MarketType, state: unknown): MarketPick | null {
  switch (type) {
    case "podium": {
      const s = state as PodiumState;
      if (!s.p1 || !s.p2 || !s.p3) return null;
      return { p1: s.p1, p2: s.p2, p3: s.p3 };
    }
    case "safety_car": {
      const s = state as SafetyState;
      return s.value == null ? null : { value: s.value };
    }
    case "first_retirement": {
      const s = state as RetireState;
      if (s.driver_id === "") return null;
      return { driver_id: s.driver_id === "none" ? null : s.driver_id };
    }
    default: {
      const s = state as DriverState;
      return s.driver_id ? { driver_id: s.driver_id } : null;
    }
  }
}

// One market's card: hint, status, countdown, the pick control for its type,
// and, once locked, the saved call next to the result and points.
export function MarketForm({
  market,
  slug,
  drivers,
  initial,
  score,
  signedIn,
  isAdmin,
  signInHref,
}: {
  market: MarketFormMarket;
  slug: string;
  drivers: DriverOption[];
  initial: MarketPick | null;
  score: { points: number; hitType: HitType } | null;
  signedIn: boolean;
  isAdmin: boolean;
  signInHref: string;
}) {
  const t = useTranslations("pickForm");
  const tm = useTranslations("markets");
  const tc = useTranslations("common");
  const tg = useTranslations("gp");
  const [state, setState] = React.useState<unknown>(() => initialState(market.type, initial));
  const [saved, setSaved] = React.useState<MarketPick | null>(initial);
  const lockShape = { locks_at: market.locksAt, status: market.status };
  const [lockedNow, setLockedNow] = React.useState<boolean>(() => lockReason(lockShape) !== null);
  const [isPending, startTransition] = React.useTransition();

  const reason = lockReason(lockShape);
  const locked = lockedNow || reason !== null;
  const pick = toPick(market.type, state);
  const podiumDuplicate =
    market.type === "podium" &&
    (() => {
      const s = state as PodiumState;
      const ids = [s.p1, s.p2, s.p3].filter(Boolean);
      return new Set(ids).size !== ids.length;
    })();
  const dirty = JSON.stringify(pick) !== JSON.stringify(saved);
  const canSubmit = signedIn && !isAdmin && !locked && pick !== null && !podiumDuplicate && dirty;

  const driverMap = React.useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);
  const pickLabels = { none: tm("none"), yes: tm("yes"), no: tm("no"), unknown: "?" };
  const selectable = drivers.filter((d) => d.active);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !pick) return;
    startTransition(async () => {
      const res = await submitPick({ marketId: market.id, slug, type: market.type, pick });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSaved(pick);
      toast.success(t("savedToast"));
    });
  }

  const statusKey: "open" | "locked" | "resolved" | "void" =
    market.status === "resolved" || market.status === "void"
      ? market.status
      : locked
        ? "locked"
        : "open";

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm",
        statusKey === "void" && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-base font-semibold tracking-tight">
            {tm(`type.${market.type}`)}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{tm(`hint.${market.type}`)}</p>
        </div>
        <MarketStatusBadge status={statusKey} label={tm(`status.${statusKey}`)} size="sm" />
      </div>

      {statusKey === "open" ? (
        <MarketLockCountdown
          locksAt={market.locksAt}
          units={{
            days: tc("units.days"),
            hours: tc("units.hours"),
            mins: tc("units.mins"),
            secs: tc("units.secs"),
          }}
          closesInTemplate={t.raw("closesIn")}
          lockedLabel={t("lockedLabel")}
          onLocked={() => setLockedNow(true)}
        />
      ) : (
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {tm(`locksAt.${MARKET_LOCK_SESSION[market.type]}`)}
        </p>
      )}

      {locked ? (
        <LockedSummary
          type={market.type}
          saved={saved}
          result={market.result}
          score={score}
          driverMap={driverMap}
          labels={{
            yourCall: tm("yourCall"),
            noCall: tm("noCall"),
            result: tm("result"),
            points: score ? tg("yourPoints", { points: score.points }) : tg("pointsPending"),
            hit: score ? tm(`hit.${score.hitType}`) : null,
            pick: pickLabels,
          }}
        />
      ) : !signedIn ? null : isAdmin ? (
        <p className="text-sm text-muted-foreground">{tg("adminCannotPick")}</p>
      ) : (
        <>
          <PickControl
            type={market.type}
            state={state}
            onChange={setState}
            drivers={selectable}
            allDrivers={driverMap}
            labels={{
              select: t("selectDriver"),
              none: tm("none"),
              yes: tm("yes"),
              no: tm("no"),
              p1: tm("position.p1"),
              p2: tm("position.p2"),
              p3: tm("position.p3"),
            }}
            disabled={isPending}
          />
          {podiumDuplicate ? (
            <p className="text-xs text-destructive">{t("errorDuplicateDrivers")}</p>
          ) : null}
          <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
            <Button
              type="submit"
              size="sm"
              variant={saved && !dirty ? "outline" : "default"}
              disabled={!canSubmit || isPending}
            >
              {isPending ? (
                <>
                  <Loader2Icon className="animate-spin" /> {t("saving")}
                </>
              ) : saved && !dirty ? (
                <>
                  <CheckIcon /> {t("saved")}
                </>
              ) : saved ? (
                t("update")
              ) : (
                t("save")
              )}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}

function PickControl({
  type,
  state,
  onChange,
  drivers,
  allDrivers,
  labels,
  disabled,
}: {
  type: MarketType;
  state: unknown;
  onChange: (next: unknown) => void;
  drivers: DriverOption[];
  allDrivers: Map<string, DriverOption>;
  labels: {
    select: string;
    none: string;
    yes: string;
    no: string;
    p1: string;
    p2: string;
    p3: string;
  };
  disabled: boolean;
}) {
  // Keep an inactive driver selectable if it is the current saved value.
  const withCurrent = (current: string) => {
    const cur = current && allDrivers.get(current);
    return cur && !drivers.some((d) => d.id === cur.id) ? [...drivers, cur] : drivers;
  };
  const options = (list: DriverOption[]) =>
    list.map((d) => (
      <option key={d.id} value={d.id}>
        {driverLabel(d)}
        {d.teamName ? ` — ${d.teamName}` : ""}
      </option>
    ));

  if (type === "podium") {
    const s = state as PodiumState;
    return (
      // One row per position: three selects side by side inside a half-width
      // card cut every driver down to "ANT · An".
      <div className="grid gap-2">
        {(["p1", "p2", "p3"] as const).map((pos) => (
          <label key={pos} className="flex items-center gap-2">
            <span className="w-7 shrink-0 rounded-md bg-muted py-1 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {labels[pos]}
            </span>
            <NativeSelect
              value={s[pos]}
              disabled={disabled}
              onChange={(e) => onChange({ ...s, [pos]: e.target.value })}
              className="h-10 min-w-0 flex-1"
            >
              <option value="">{labels.select}</option>
              {options(withCurrent(s[pos]))}
            </NativeSelect>
          </label>
        ))}
      </div>
    );
  }

  if (type === "safety_car") {
    const s = state as SafetyState;
    return (
      <div className="grid grid-cols-2 gap-2" role="radiogroup">
        {[
          { value: true, label: labels.yes },
          { value: false, label: labels.no },
        ].map((opt) => {
          const active = s.value === opt.value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange({ value: opt.value })}
              className={cn(
                "h-10 rounded-lg border text-sm font-semibold uppercase tracking-[0.14em] transition-colors",
                active
                  ? "border-signal bg-signal/15 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  const s = state as DriverState | RetireState;
  return (
    <NativeSelect
      value={s.driver_id}
      disabled={disabled}
      onChange={(e) => onChange({ driver_id: e.target.value })}
      className="h-10"
    >
      <option value="">{labels.select}</option>
      {type === "first_retirement" ? <option value="none">{labels.none}</option> : null}
      {options(withCurrent(s.driver_id === "none" ? "" : s.driver_id))}
    </NativeSelect>
  );
}

function LockedSummary({
  type,
  saved,
  result,
  score,
  driverMap,
  labels,
}: {
  type: MarketType;
  saved: MarketPick | null;
  result: MarketPick | null;
  score: { points: number; hitType: HitType } | null;
  driverMap: Map<string, DriverOption>;
  labels: {
    yourCall: string;
    noCall: string;
    result: string;
    points: string;
    hit: string | null;
    pick: { none: string; yes: string; no: string; unknown: string };
  };
}) {
  const hitTone =
    score?.hitType === "miss"
      ? "text-muted-foreground"
      : score
        ? "text-signal"
        : "text-muted-foreground";
  return (
    <dl className="grid gap-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {labels.yourCall}
        </dt>
        <dd className={cn("font-medium", !saved && "text-muted-foreground")}>
          {saved ? formatPick(type, saved, driverMap, labels.pick) : labels.noCall}
        </dd>
      </div>
      {result ? (
        <div className="flex items-center justify-between gap-3">
          <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {labels.result}
          </dt>
          <dd className="font-medium">{formatPick(type, result, driverMap, labels.pick)}</dd>
        </div>
      ) : null}
      {result && saved ? (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
          <dt className={cn("font-mono text-[10px] uppercase tracking-[0.2em]", hitTone)}>
            {labels.hit ?? ""}
          </dt>
          <dd className={cn("font-mono text-base font-semibold tabular-nums", hitTone)}>
            {labels.points}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

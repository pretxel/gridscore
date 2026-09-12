"use client";

import type { DriverOption } from "@/lib/driver-format";
import { cn } from "@/lib/utils";

// Picking a driver from a twenty-name dropdown means opening a list, scrolling
// it, and reading full names to find the one you already know by its code.
// This lays the field out the way a grid sheet reads: two columns, team-mates
// together, each driver anchored by the three-letter code with the team's own
// colour as a rule down the side. One tap picks.
//
// The podium uses the same grid with three slots above it. Tapping fills the
// next empty slot, so the order you tap is the order you are calling — which
// also makes it impossible to name the same driver twice, the one mistake the
// old three-dropdown version let you make and only caught on save.

export type DriverPickerLabels = {
  // One per slot in ordered mode, e.g. P1 / P2 / P3.
  slots: string[];
  // Shown in an empty slot.
  slotEmpty: string;
  // Accessible name for the button that clears a slot.
  clearSlot: string;
  // The "nobody retires" choice on the first-retirement market.
  none?: string;
  // Describes the grid for screen readers.
  fieldLabel: string;
};

export function DriverPicker({
  drivers,
  selected,
  onChange,
  mode = "single",
  slots = 1,
  labels,
  disabled = false,
  allowNone = false,
}: {
  drivers: DriverOption[];
  // Driver ids in pick order. The literal "none" is allowed when `allowNone`.
  selected: string[];
  onChange: (next: string[]) => void;
  mode?: "single" | "ordered";
  slots?: number;
  labels: DriverPickerLabels;
  disabled?: boolean;
  allowNone?: boolean;
}) {
  const byId = new Map(drivers.map((d) => [d.id, d]));
  // Sorted by team so the two columns put team-mates on the same row, the way
  // a grid sheet is read. Ties fall back to surname for a stable order.
  const ordered = [...drivers].sort(
    (a, b) =>
      (a.teamName ?? "").localeCompare(b.teamName ?? "") ||
      a.familyName.localeCompare(b.familyName),
  );

  function toggle(id: string): void {
    if (disabled) return;
    if (mode === "single") {
      onChange(selected[0] === id ? [] : [id]);
      return;
    }
    const at = selected.indexOf(id);
    if (at !== -1) {
      onChange(selected.filter((s) => s !== id));
      return;
    }
    if (selected.length >= slots) return;
    onChange([...selected, id]);
  }

  return (
    <div className="grid gap-3">
      {mode === "ordered" ? (
        <ol className="grid grid-cols-3 gap-2">
          {Array.from({ length: slots }, (_, i) => {
            const id = selected[i];
            const driver = id ? byId.get(id) : undefined;
            return (
              <li key={labels.slots[i]}>
                {driver ? (
                  // The slot itself is the clear control: at this width a
                  // separate ✕ crowds the code it sits next to.
                  <button
                    type="button"
                    onClick={() => toggle(driver.id)}
                    disabled={disabled}
                    aria-label={`${labels.clearSlot} ${labels.slots[i]}`}
                    className="flex h-11 w-full items-center gap-1.5 rounded-lg border border-signal/60 bg-signal/10 px-2 text-left hover:bg-signal/20 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    style={driver.teamColor ? { borderLeftColor: driver.teamColor } : undefined}
                  >
                    <span className="shrink-0 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground">
                      {labels.slots[i]}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold">
                      {driver.code ?? driver.familyName}
                    </span>
                  </button>
                ) : (
                  <div className="flex h-11 items-center gap-1.5 rounded-lg border border-dashed border-border px-2">
                    <span className="shrink-0 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground">
                      {labels.slots[i]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {labels.slotEmpty}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}

      <div role="group" aria-label={labels.fieldLabel} className="grid grid-cols-2 gap-1.5">
        {allowNone && labels.none ? (
          <DriverChip
            key="none"
            // A dash where a code would be: this row is a call, not a driver.
            label="—"
            sublabel={labels.none}
            selected={selected[0] === "none"}
            order={null}
            disabled={disabled}
            onClick={() => onChange(selected[0] === "none" ? [] : ["none"])}
            className="col-span-2"
          />
        ) : null}

        {ordered.map((driver) => {
          const at = selected.indexOf(driver.id);
          const full =
            mode === "ordered" && at === -1 && selected.filter((s) => s !== "none").length >= slots;
          return (
            <DriverChip
              key={driver.id}
              label={driver.code ?? driver.familyName}
              // Surname alone: it is how a driver is called on the timing
              // screen, and it leaves room for the team beside it.
              sublabel={driver.familyName}
              team={driver.teamName}
              teamColor={driver.teamColor}
              selected={at !== -1}
              order={mode === "ordered" && at !== -1 ? labels.slots[at] : null}
              // A full podium greys out the rest rather than silently ignoring
              // a tap.
              disabled={disabled || full}
              onClick={() => toggle(driver.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function DriverChip({
  label,
  sublabel,
  team,
  teamColor,
  selected,
  order,
  disabled,
  onClick,
  className,
}: {
  label: string;
  sublabel?: string;
  team?: string | null;
  teamColor?: string | null;
  selected: boolean;
  order: string | null;
  disabled: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-lg border border-l-[3px] px-2.5 py-2.5 text-left transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected
          ? "border-signal bg-signal/15"
          : "border-border bg-background hover:bg-muted disabled:hover:bg-background",
        disabled && !selected && "opacity-40",
        className,
      )}
      // The team's colour, straight from the roster, is what tells two cars
      // apart at a glance.
      style={teamColor ? { borderLeftColor: teamColor } : undefined}
    >
      <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">{label}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{sublabel}</span>
      {/* The slot badge takes the team's place once a driver is called: the
          position you gave them is the more useful fact at that point. */}
      {order ? (
        <span className="shrink-0 rounded-md bg-signal px-1.5 py-0.5 font-mono text-[10px] font-semibold text-signal-foreground">
          {order}
        </span>
      ) : team ? (
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">{team}</span>
      ) : null}
    </button>
  );
}

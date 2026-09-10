import { BanIcon, CheckIcon, LockIcon, TimerIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "open" | "locked" | "resolved" | "void";

const palette: Record<Status, string> = {
  open: "bg-secondary text-secondary-foreground ring-1 ring-inset ring-border",
  locked: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  resolved: "bg-signal text-signal-foreground ring-1 ring-inset ring-signal/50",
  void: "bg-muted text-muted-foreground line-through ring-1 ring-inset ring-border",
};

const icons = {
  open: TimerIcon,
  locked: LockIcon,
  resolved: CheckIcon,
  void: BanIcon,
} as const;

export function MarketStatusBadge({
  status,
  label,
  size = "default",
  className,
}: {
  status: Status;
  label: string;
  size?: "default" | "sm";
  className?: string;
}) {
  const Icon = icons[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-mono font-medium uppercase tracking-[0.14em]",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        palette[status],
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden />
      <span>{label}</span>
    </span>
  );
}

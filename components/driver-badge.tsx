import { cn } from "@/lib/utils";

// Driver identity chip: team color swatch, three-letter code, name.
export function DriverBadge({
  code,
  givenName,
  familyName,
  teamName,
  teamColor,
  size = "default",
  className,
}: {
  code: string | null;
  givenName: string;
  familyName: string;
  teamName?: string | null;
  teamColor?: string | null;
  size?: "default" | "sm";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-sm ring-1 ring-foreground/20"
        style={{ backgroundColor: teamColor ?? "var(--muted-foreground)" }}
      />
      {code ? (
        <span
          className={cn(
            "shrink-0 font-mono font-semibold tracking-[0.12em]",
            size === "sm" ? "text-[11px]" : "text-xs",
          )}
        >
          {code}
        </span>
      ) : null}
      <span className={cn("truncate", size === "sm" ? "text-xs" : "text-sm")}>
        {givenName} {familyName}
      </span>
      {teamName ? (
        <span className="hidden truncate text-xs text-muted-foreground sm:inline">{teamName}</span>
      ) : null}
    </span>
  );
}

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Scannable status tile for the dashboard and competitions list: a mono label,
// a prominent value, optional status badges, free-form meta/children, and a
// grouped action row. Built on the shared Card so it stays on-brand.
export function StatusCard({
  label,
  value,
  badges,
  meta,
  actions,
  children,
  className,
}: {
  label?: React.ReactNode;
  value: React.ReactNode;
  badges?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-3 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {label ? (
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {label}
            </div>
          ) : null}
          <div className="font-heading text-lg leading-snug font-semibold">{value}</div>
          {meta ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {meta}
            </div>
          ) : null}
        </div>
        {badges ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">{badges}</div>
        ) : null}
      </div>
      {children}
      {actions ? <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div> : null}
    </Card>
  );
}

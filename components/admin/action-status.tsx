import { cn } from "@/lib/utils";

type Variant = "info" | "success" | "error";

const VARIANT_CLASS: Record<Variant, string> = {
  info: "border-border bg-muted/40 text-foreground",
  success: "border-primary/30 bg-primary/10 text-foreground [&_strong]:text-primary",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
};

// Consistent inline outcome panel for server-action results (sync summary,
// resend summary, errors). Pairs with the query-param result pattern the admin
// actions already use. `error` announces assertively; others politely.
//
// `live` (default true) controls whether this panel is itself an aria-live
// region. Set `live={false}` when the panel is conditionally mounted only after
// a navigation (where a freshly-inserted live region is not reliably announced)
// and a separate always-mounted <LiveRegion> handles the announcement instead —
// this keeps the panel purely visual and avoids double-announcing.
export function ActionStatus({
  variant = "info",
  live = true,
  children,
  className,
}: {
  variant?: Variant;
  live?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={live ? (variant === "error" ? "alert" : "status") : undefined}
      aria-live={live ? (variant === "error" ? "assertive" : "polite") : undefined}
      className={cn("rounded-lg border px-3 py-2 text-sm", VARIANT_CLASS[variant], className)}
    >
      {children}
    </div>
  );
}

import { cn } from "@/lib/utils";

// Five lamps that fill left to right and then go out, the way a race starts.
// Decorative: the label is what a screen reader hears, and the animation is
// pure CSS so it costs no JavaScript and stops under `prefers-reduced-motion`.
export function StartingLights({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={cn(
        "lights inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-2.5 py-2",
        className,
      )}
      role="img"
      aria-label={label}
    >
      {[0, 1, 2, 3, 4].map((lamp) => (
        <span key={lamp} aria-hidden className="lights__lamp size-2.5 rounded-full sm:size-3" />
      ))}
    </div>
  );
}

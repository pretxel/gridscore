import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// Locale-agnostic fallback for paths outside the [locale] tree. The localized
// version lives at app/[locale]/not-found.tsx.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
        Off track · 404
      </p>
      <h1
        className="mt-2 font-heading text-6xl font-semibold leading-none tracking-tight sm:text-7xl"
        style={{ fontStretch: "condensed" }}
      >
        404
      </h1>
      <p className="mt-4 max-w-sm text-sm text-muted-foreground">
        That page isn&apos;t on the calendar. Head back to the paddock.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonVariants()}>
          Back home
        </Link>
      </div>
    </main>
  );
}

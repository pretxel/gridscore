"use client";

import { TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

// Locale-agnostic fallback. The localized version lives at
// app/[locale]/error.tsx and handles errors within the i18n tree.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative isolate mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/30">
        <TriangleAlertIcon className="size-5" />
      </span>
      <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
        Red flag
      </p>
      <h1
        className="mt-2 font-heading text-4xl font-semibold tracking-tight sm:text-5xl"
        style={{ fontStretch: "condensed" }}
      >
        Something went wrong
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred."}
      </p>
      {error.digest ? (
        <p className="mt-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground/70">
          ref: {error.digest}
        </p>
      ) : null}
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Home
        </Link>
      </div>
    </main>
  );
}

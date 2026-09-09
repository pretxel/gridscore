import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Mirrors the universal page wrapper (`mx-auto max-w-4xl px-4 py-10`) and the
// standard eyebrow / headline / lede header used across leaderboard, matches,
// news, quiz, my-picks and groups. Provides the single role="status" /
// aria-busy region (with an sr-only label) so every route fallback inherits
// correct loading semantics and identical horizontal rhythm to the real page.
//
// `header` controls the default header block: undefined renders the standard
// header, `false` renders none (for centered share-style pages), and a node
// renders a custom header. loading.tsx files must stay locale-agnostic, so the
// label defaults to a neutral literal rather than a translated string.
export function PageSkeletonShell({
  children,
  header,
  headerRight,
  className,
  label = "Loading",
}: {
  children?: ReactNode;
  header?: ReactNode | false;
  headerRight?: ReactNode;
  className?: string;
  label?: string;
}) {
  const showDefaultHeader = header === undefined;
  return (
    <main
      role="status"
      aria-busy="true"
      aria-live="off"
      className={cn("mx-auto max-w-4xl px-4 py-10", className)}
    >
      <span className="sr-only">{label}</span>
      {showDefaultHeader ? (
        <header className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-9 w-64 sm:h-11 sm:w-80" />
            <Skeleton className="mt-3 h-4 w-72 max-w-full" />
          </div>
          {headerRight}
        </header>
      ) : header ? (
        header
      ) : null}
      {children}
    </main>
  );
}

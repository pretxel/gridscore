import { PageSkeletonShell } from "@/components/skeletons/page-skeleton-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarLoading() {
  return (
    <PageSkeletonShell>
      <div className="grid gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-6 w-56" />
            <Skeleton className="mt-2 h-4 w-72 max-w-full" />
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        ))}
      </div>
    </PageSkeletonShell>
  );
}

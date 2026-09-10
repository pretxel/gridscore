import { PageSkeletonShell } from "@/components/skeletons/page-skeleton-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function LeaderboardLoading() {
  return (
    <PageSkeletonShell headerRight={<Skeleton className="h-16 w-40 rounded-xl" />}>
      <Skeleton className="mb-4 h-8 w-64" />
      <div className="rounded-xl border border-border bg-card">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0"
          >
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-10" />
          </div>
        ))}
      </div>
    </PageSkeletonShell>
  );
}

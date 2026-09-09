import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Responsive grid of placeholder cards mirroring the Card primitive shell
// (`rounded-xl bg-card ring-1 ring-foreground/10`). Covers the news article
// grid, admin dashboard cards and feature/stat card grids. A manual card
// container is used (rather than <Card>) so the optional image area sits flush
// at the top without the Card's default top padding.
export function CardGridSkeleton({
  count = 6,
  cols = 3,
  withImage = false,
  withFooter = false,
  bodyLines = 3,
  className,
}: {
  count?: number;
  cols?: 2 | 3 | 4;
  withImage?: boolean;
  withFooter?: boolean;
  bodyLines?: number;
  className?: string;
}) {
  const colClass =
    cols === 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : cols === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={cn("grid grid-cols-1 gap-4", colClass, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
        >
          {withImage ? <Skeleton className="aspect-video w-full rounded-none" /> : null}
          <div className="flex flex-col gap-3 p-4">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: bodyLines }).map((_, j) => (
                <Skeleton key={j} className={cn("h-3 w-full", j === bodyLines - 1 && "w-2/3")} />
              ))}
            </div>
            {withFooter ? (
              <div className="mt-1 flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

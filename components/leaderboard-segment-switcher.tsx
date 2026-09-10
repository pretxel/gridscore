"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

export type SegmentOption = { slug: string; label: string };

// Season / weekend switch. Season is a link; the weekend picker is a native
// select that navigates on change so the URL stays the source of truth.
export function LeaderboardSegmentSwitcher({
  basePath,
  activeSlug,
  options,
  labels,
}: {
  basePath: string;
  activeSlug: string | null;
  options: SegmentOption[];
  labels: { overall: string; grandPrix: string; select: string };
}) {
  const router = useRouter();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Link
        href={basePath}
        className={cn(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          activeSlug === null
            ? "bg-signal/15 text-foreground ring-1 ring-inset ring-signal/40"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        aria-current={activeSlug === null ? "page" : undefined}
      >
        {labels.overall}
      </Link>
      <label className="flex items-center gap-2 text-sm">
        <span className="sr-only">{labels.grandPrix}</span>
        <NativeSelect
          value={activeSlug ?? ""}
          aria-label={labels.grandPrix}
          onChange={(e) => {
            const slug = e.target.value;
            router.push(slug ? `${basePath}?gp=${encodeURIComponent(slug)}` : basePath);
          }}
          className={cn(
            "h-8 w-auto min-w-[12rem]",
            activeSlug && "ring-1 ring-inset ring-signal/40 bg-signal/10",
          )}
        >
          <option value="">{labels.select}</option>
          {options.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </label>
    </div>
  );
}

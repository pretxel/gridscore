import { getTranslations } from "next-intl/server";
import {
  type SponsorPlacement,
  safeSponsorHref,
  shouldRenderSponsor,
  sponsorFor,
} from "@/lib/sponsor";
import { cn } from "@/lib/utils";

// One advertising slot. Pro readers get `sponsorFree`, so the slot renders
// nothing for them — that is the whole upgrade promise, kept in one place.
//
// With no sponsor booked the slot still renders, as a quiet bordered
// placeholder: it reserves the layout so a real creative later cannot shift
// the page, and it is honest about being empty rather than faking an ad.
export async function SponsorSlot({
  placement,
  plan,
  className,
}: {
  placement: SponsorPlacement;
  plan: string | null | undefined;
  className?: string;
}) {
  if (!shouldRenderSponsor(plan)) return null;

  const t = await getTranslations("sponsor");
  const creative = sponsorFor(placement);
  const href = safeSponsorHref(creative?.href);

  const label = (
    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
      {creative ? t("label") : t("available")}
    </span>
  );

  const body = creative ? (
    <span className="min-w-0">
      <span className="block truncate text-sm font-medium">{creative.name}</span>
      {creative.tagline ? (
        <span className="block truncate text-xs text-muted-foreground">{creative.tagline}</span>
      ) : null}
    </span>
  ) : (
    <span className="truncate text-xs text-muted-foreground">{t("placeholder")}</span>
  );

  const shell = cn(
    "flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2",
    placement === "header" && "hidden lg:flex",
    className,
  );

  if (href) {
    return (
      <a
        href={href}
        rel="sponsored noopener"
        target="_blank"
        className={cn(shell, "border-solid transition-colors hover:bg-muted/50")}
        data-slot="sponsor"
        data-placement={placement}
      >
        {label}
        {body}
      </a>
    );
  }

  return (
    <div className={shell} data-slot="sponsor" data-placement={placement}>
      {label}
      {body}
    </div>
  );
}

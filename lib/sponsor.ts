// Sponsor inventory. Static today: no deal is signed, so every placement
// resolves to `null` and the slot renders its own "space available"
// placeholder. When a sponsor arrives, fill in the entry here — nothing else
// has to change.
//
// A creative is deliberately text-only: an image would have to be hosted and
// approved, and the brand guard forbids shipping championship artwork.

import { hasFeature } from "@/lib/plans";

export const SPONSOR_PLACEMENTS = ["header", "gp-detail", "leaderboard"] as const;

export type SponsorPlacement = (typeof SPONSOR_PLACEMENTS)[number];

export type SponsorCreative = {
  // Shown as the sponsor's name.
  name: string;
  // One short line under the name. Not translated: a sponsor supplies their
  // own wording.
  tagline?: string;
  // Absolute URL. Rendered with rel="sponsored noopener" and target="_blank".
  href?: string;
};

const INVENTORY: Record<SponsorPlacement, SponsorCreative | null> = {
  header: null,
  "gp-detail": null,
  leaderboard: null,
};

export function sponsorFor(placement: SponsorPlacement): SponsorCreative | null {
  return INVENTORY[placement];
}

export function isSponsorPlacement(value: string): value is SponsorPlacement {
  return (SPONSOR_PLACEMENTS as readonly string[]).includes(value);
}

// An href is only rendered when it is an absolute https URL, so a bad config
// entry cannot turn into a javascript: link.
export function safeSponsorHref(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const url = new URL(href);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// Whether a viewer sees advertising at all. Pro's `sponsorFree` capability is
// the only thing that turns slots off, so the rule lives here once and
// `SponsorSlot` just obeys it.
export function shouldRenderSponsor(plan: string | null | undefined): boolean {
  return !hasFeature(plan, "sponsorFree");
}

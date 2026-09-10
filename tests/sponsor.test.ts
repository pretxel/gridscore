import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSponsorPlacement,
  SPONSOR_PLACEMENTS,
  safeSponsorHref,
  shouldRenderSponsor,
  sponsorFor,
} from "@/lib/sponsor";

describe("shouldRenderSponsor", () => {
  it("shows slots to free and anonymous viewers", () => {
    expect(shouldRenderSponsor("free")).toBe(true);
    expect(shouldRenderSponsor(null)).toBe(true);
    expect(shouldRenderSponsor(undefined)).toBe(true);
    // An unrecognised plan must not silently buy an ad-free experience.
    expect(shouldRenderSponsor("platinum")).toBe(true);
  });

  it("hides them from pro", () => {
    expect(shouldRenderSponsor("pro")).toBe(false);
  });
});

describe("sponsor inventory", () => {
  it("knows its placements", () => {
    for (const placement of SPONSOR_PLACEMENTS) {
      expect(isSponsorPlacement(placement)).toBe(true);
    }
    expect(isSponsorPlacement("sidebar")).toBe(false);
  });

  it("has no creative booked yet, so every slot renders its placeholder", () => {
    for (const placement of SPONSOR_PLACEMENTS) {
      expect(sponsorFor(placement)).toBeNull();
    }
  });
});

describe("safeSponsorHref", () => {
  it("accepts absolute https URLs", () => {
    expect(safeSponsorHref("https://example.test/offer")).toBe("https://example.test/offer");
  });

  it("refuses anything else", () => {
    expect(safeSponsorHref("http://example.test")).toBeNull();
    expect(safeSponsorHref("javascript:alert(1)")).toBeNull();
    expect(safeSponsorHref("/relative")).toBeNull();
    expect(safeSponsorHref(undefined)).toBeNull();
  });
});

describe("SponsorSlot", () => {
  it("obeys shouldRenderSponsor before rendering anything", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "..", "components", "sponsor-slot.tsx"),
      "utf8",
    );
    expect(source).toContain("if (!shouldRenderSponsor(plan)) return null;");
  });
});

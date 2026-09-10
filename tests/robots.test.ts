import { describe, expect, it, vi } from "vitest";
import { SUPPORTED_LOCALES } from "@/lib/i18n";

vi.mock("@/lib/env", () => ({ env: { siteUrl: "https://gridscore.test" } }));

const { default: robots } = await import("@/app/robots");

describe("robots", () => {
  const rule = robots().rules;
  const first = Array.isArray(rule) ? rule[0] : rule;
  const disallow = (first.disallow ?? []) as string[];

  it("hides every signed-in route in both locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const path of ["/admin", "/my-picks", "/leagues", "/stats", "/onboarding"]) {
        expect(disallow, `${locale}${path}`).toContain(`/${locale}${path}`);
      }
    }
  });

  it("hides the auth callback, which carries no locale", () => {
    expect(disallow).toContain("/auth/");
  });

  it("leaves the public routes crawlable", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const path of ["", "/gp", "/leaderboard", "/how-it-works"]) {
        expect(disallow).not.toContain(`/${locale}${path}`);
      }
    }
  });

  it("points at the sitemap", () => {
    expect(robots().sitemap).toBe("https://gridscore.test/sitemap.xml");
  });
});

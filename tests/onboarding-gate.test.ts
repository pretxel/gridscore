import { describe, expect, it } from "vitest";
import { resolveOnboardingRedirect } from "@/lib/onboarding/gate";

describe("resolveOnboardingRedirect", () => {
  it("sends users without a display name to onboarding", () => {
    expect(resolveOnboardingRedirect({ displayName: null })).toBe("/onboarding");
    expect(resolveOnboardingRedirect({ displayName: "" })).toBe("/onboarding");
    expect(resolveOnboardingRedirect({ displayName: "   " })).toBe("/onboarding");
  });

  it("lets onboarded users through", () => {
    expect(resolveOnboardingRedirect({ displayName: "Ayrton S." })).toBeNull();
  });
});

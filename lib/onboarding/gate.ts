// Decides where a signed-in user belongs before they reach the app. Pure so it
// can be tested without stubbing Next's `redirect`.

export type OnboardingRedirect = "/onboarding" | null;

export interface OnboardingState {
  displayName: string | null;
}

export function resolveOnboardingRedirect(input: OnboardingState): OnboardingRedirect {
  // A display name is required to appear on a leaderboard, so it gates first.
  if (!input.displayName || input.displayName.trim().length === 0) return "/onboarding";
  return null;
}

import { z } from "zod";

// Single source of truth for display-name validation, shared by the onboarding
// flow (lib/.../onboarding) and the profile menu's inline edit so the 2–32
// trimmed rule can't drift between them.
export const displayNameField = z.string().trim().min(2).max(32);

export const displayNameSchema = z.object({
  display_name: displayNameField,
});

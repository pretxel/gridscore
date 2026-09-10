"use server";

import { cookies } from "next/headers";
import { MANAGED_SEASON_COOKIE } from "@/lib/admin/managed-season";
import {
  localeFromForm,
  multiplierReasonSchema,
  multiplierSchema,
  trimmed,
  uuidSchema,
} from "@/lib/admin/parse";
import { runAdminAction } from "@/lib/admin/run-action";
import { localePath } from "@/lib/i18n";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// A hand-set multiplier is locked so the next calendar sync leaves it alone;
// `runCalendarSync` counts those as `multipliersSkippedLocked`.
export async function setMultiplier(form: FormData): Promise<never> {
  const locale = localeFromForm(form);
  const listPath = localePath(locale, "/admin/grands-prix");
  return runAdminAction(listPath, ["/admin/grands-prix", "/gp", "/how-it-works"], async () => {
    const id = uuidSchema.parse(trimmed(form, "grand_prix_id"));
    const multiplier = multiplierSchema.parse(trimmed(form, "multiplier"));
    const reason = multiplierReasonSchema.parse(trimmed(form, "multiplier_reason"));

    const admin = createAdminSupabaseClient();
    const { error } = await admin
      .from("grands_prix")
      .update({ multiplier, multiplier_reason: reason, multiplier_locked: true })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return "multiplierSaved";
  });
}

// Lets the calendar sync own the multiplier again.
export async function unlockMultiplier(form: FormData): Promise<never> {
  const locale = localeFromForm(form);
  const listPath = localePath(locale, "/admin/grands-prix");
  return runAdminAction(listPath, ["/admin/grands-prix"], async () => {
    const id = uuidSchema.parse(trimmed(form, "grand_prix_id"));
    const admin = createAdminSupabaseClient();
    const { error } = await admin
      .from("grands_prix")
      .update({ multiplier_locked: false })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return "multiplierUnlocked";
  });
}

// Rescoring is the explicit follow-up to a multiplier or rule edit: those
// never rescore by themselves.
export async function recomputeGrandPrix(form: FormData): Promise<never> {
  const locale = localeFromForm(form);
  const back = trimmed(form, "back") || localePath(locale, "/admin/grands-prix");
  return runAdminAction(
    back,
    ["/admin/grands-prix", "/leaderboard", "/my-picks", "/gp"],
    async () => {
      const id = uuidSchema.parse(trimmed(form, "grand_prix_id"));
      const admin = createAdminSupabaseClient();
      const { error } = await admin.rpc("compute_grand_prix_scores", { p_gp_id: id });
      if (error) throw new Error(error.message);
      return "recomputed";
    },
  );
}

// Points the whole admin panel at another season without touching
// `seasons.status`, which every visitor sees.
export async function setManagedSeason(form: FormData): Promise<never> {
  const locale = localeFromForm(form);
  const listPath = localePath(locale, "/admin/grands-prix");
  return runAdminAction(listPath, ["/admin"], async () => {
    const slug = trimmed(form, "season_slug");
    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from("seasons")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`unknown season: ${slug}`);

    const store = await cookies();
    store.set(MANAGED_SEASON_COOKIE, data.slug, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return "seasonSwitched";
  });
}

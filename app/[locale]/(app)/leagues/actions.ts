"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { leagueErrorKey, leagueNameSchema, normalizeJoinCode } from "@/lib/league-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type LeagueActionResult =
  | { ok: true; leagueId: string }
  | { ok: false; error: string; code?: string };

const idSchema = z.string().uuid();

async function translateError(error: { code?: string; message: string } | null) {
  const t = await getTranslations("leagues");
  const key = leagueErrorKey(error);
  return { ok: false as const, error: t(key), code: key };
}

function revalidateLeagues(leagueId?: string) {
  for (const locale of SUPPORTED_LOCALES) {
    revalidatePath(`/${locale}/leagues`);
    if (leagueId) revalidatePath(`/${locale}/leagues/${leagueId}`);
  }
}

// All mutations go through the SECURITY DEFINER RPCs (or owner-only RLS for
// rename/delete). The database decides; these actions only shape input,
// translate refusals and refresh the pages that show the league.
export async function createLeagueAction(input: { name: unknown }): Promise<LeagueActionResult> {
  const name = leagueNameSchema.safeParse(input.name);
  if (!name.success) return translateError({ message: "league name must be" });
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_league", { p_name: name.data });
  if (error || !data) {
    if (error) console.error("[leagues] create failed:", error.message);
    return translateError(error);
  }
  revalidateLeagues(data);
  return { ok: true, leagueId: data };
}

export async function joinLeagueAction(input: { code: unknown }): Promise<LeagueActionResult> {
  const code = normalizeJoinCode(typeof input.code === "string" ? input.code : null);
  if (!code) return translateError({ message: "invalid join code" });
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("join_league", { p_code: code });
  if (error || !data) {
    if (error && !/league is full|invalid join code/i.test(error.message)) {
      console.error("[leagues] join failed:", error.message);
    }
    return translateError(error);
  }
  revalidateLeagues(data);
  return { ok: true, leagueId: data };
}

export async function renameLeagueAction(input: {
  leagueId: unknown;
  name: unknown;
}): Promise<LeagueActionResult> {
  const id = idSchema.safeParse(input.leagueId);
  const name = leagueNameSchema.safeParse(input.name);
  if (!id.success) return translateError(null);
  if (!name.success) return translateError({ message: "league name must be" });
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("leagues")
    .update({ name: name.data })
    .eq("id", id.data)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[leagues] rename failed:", error.message);
    return translateError(error);
  }
  // RLS hides non-owned rows, so a silent zero-row update means "not owner".
  if (!data) return translateError({ message: "only the owner can rename" });
  revalidateLeagues(id.data);
  return { ok: true, leagueId: id.data };
}

export async function leaveLeagueAction(input: { leagueId: unknown }): Promise<LeagueActionResult> {
  const id = idSchema.safeParse(input.leagueId);
  if (!id.success) return translateError(null);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("leave_league", { p_league_id: id.data });
  if (error) return translateError(error);
  revalidateLeagues(id.data);
  return { ok: true, leagueId: id.data };
}

export async function removeMemberAction(input: {
  leagueId: unknown;
  userId: unknown;
}): Promise<LeagueActionResult> {
  const id = idSchema.safeParse(input.leagueId);
  const user = idSchema.safeParse(input.userId);
  if (!id.success || !user.success) return translateError(null);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("remove_league_member", {
    p_league_id: id.data,
    p_user_id: user.data,
  });
  if (error) return translateError(error);
  revalidateLeagues(id.data);
  return { ok: true, leagueId: id.data };
}

export async function deleteLeagueAction(input: {
  leagueId: unknown;
}): Promise<LeagueActionResult> {
  const id = idSchema.safeParse(input.leagueId);
  if (!id.success) return translateError(null);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("leagues").delete().eq("id", id.data).select("id");
  if (error) {
    console.error("[leagues] delete failed:", error.message);
    return translateError(error);
  }
  if (!data || data.length === 0) return translateError({ message: "only the owner can delete" });
  revalidateLeagues(id.data);
  return { ok: true, leagueId: id.data };
}

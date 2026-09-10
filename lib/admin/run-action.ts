import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/admin/current-user";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Shared shape for every admin server action: verify the caller, run the work,
// then bounce back to the page with the outcome in the query string. The admin
// screens render it through <ActionStatus> and announce it via <LiveRegion>.
//
// `redirect()` signals by throwing, so it is called after the try/catch — a
// redirect inside would be reported as a failure.

export const ADMIN_ONLY = "Admin only";

// Detail is shown to operators, so it carries the database's own wording;
// truncated because it travels in a URL.
const DETAIL_MAX = 180;

function detailOf(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.slice(0, DETAIL_MAX);
}

export type AdminActionOutcome = { ok: string } | { error: string; detail?: string };

// Runs `work` as an admin and returns the outcome instead of redirecting.
// Exported for the actions that need to redirect somewhere computed from the
// result (creating a row, then opening its editor).
export async function runAsAdmin(work: () => Promise<string>): Promise<AdminActionOutcome> {
  try {
    const supabase = await createServerSupabaseClient();
    await assertAdmin(supabase);
    return { ok: await work() };
  } catch (err) {
    const detail = detailOf(err);
    if (detail === ADMIN_ONLY) return { error: "forbidden" };
    console.error("[admin] action failed:", err);
    return { error: "failed", detail };
  }
}

export function outcomeQuery(outcome: AdminActionOutcome): string {
  const params = new URLSearchParams();
  if ("ok" in outcome) params.set("ok", outcome.ok);
  else {
    params.set("error", outcome.error);
    if (outcome.detail) params.set("detail", outcome.detail);
  }
  return params.toString();
}

// Refreshes every locale of the paths an admin write can change.
export function revalidateAdminPaths(paths: string[]): void {
  for (const locale of SUPPORTED_LOCALES) {
    for (const path of paths) revalidatePath(`/${locale}${path}`);
  }
}

// The common case: run, revalidate, redirect back to `target` with the result.
export async function runAdminAction(
  target: string,
  revalidate: string[],
  work: () => Promise<string>,
): Promise<never> {
  const outcome = await runAsAdmin(work);
  if ("ok" in outcome) revalidateAdminPaths(revalidate);
  redirect(`${target}?${outcomeQuery(outcome)}`);
}

import { NextResponse } from "next/server";
import { authorizeCron, skipped } from "@/lib/cron/authorize";
import { resendMailer } from "@/lib/email/resend";
import { env } from "@/lib/env";
import { recordRun } from "@/lib/operations/record-run";
import { isOperationEnabled } from "@/lib/operations/settings";
import { runReminders } from "@/lib/reminders/run";
import { createSupabaseReminderStore } from "@/lib/reminders/store";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Hourly: email each player the markets they have not called that lock
// within their lead time. Called by pg_cron in Supabase (Vercel Hobby runs a
// cron only once a day); authorized with the same bearer as the other jobs.
export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;
  if (!(await isOperationEnabled("send_reminders"))) return skipped("disabled");

  const mailer = resendMailer();
  if (!mailer.available() || !env.reminderSigningSecret) return skipped("missing-env");
  const signingSecret = env.reminderSigningSecret;

  const admin = createAdminSupabaseClient();
  const { summary } = await recordRun("send_reminders", "cron", () =>
    runReminders({
      store: createSupabaseReminderStore(admin),
      mailer,
      siteUrl: env.siteUrl,
      signingSecret,
    }),
  );
  console.log("[cron:send-reminders] summary:", JSON.stringify(summary));
  return NextResponse.json(summary);
}

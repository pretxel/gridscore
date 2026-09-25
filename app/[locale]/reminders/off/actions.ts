"use server";

import { redirect } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/lib/i18n";
import { optOutWithToken } from "@/lib/reminders/opt-out";

export async function confirmOptOut(formData: FormData): Promise<never> {
  const raw = formData.get("locale");
  const locale = typeof raw === "string" && isLocale(raw) ? raw : DEFAULT_LOCALE;
  const token = formData.get("t");
  const ok = await optOutWithToken(typeof token === "string" ? token : null);
  redirect(`${localePath(locale, "/reminders/off")}?${ok ? "done=1" : "invalid=1"}`);
}

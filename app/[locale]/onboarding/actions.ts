"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { displayNameSchema } from "@/lib/display-name";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/lib/i18n";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function setDisplayName(formData: FormData) {
  const rawLocale = formData.get("locale");
  const locale = typeof rawLocale === "string" && isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  const parsed = displayNameSchema.safeParse({
    display_name: formData.get("display_name"),
  });
  if (!parsed.success) {
    const t = await getTranslations({ locale, namespace: "onboarding" });
    throw new Error(t("invalid"));
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(localePath(locale, "/sign-in"));

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.display_name })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");
  redirect(localePath(locale, "/"));
}

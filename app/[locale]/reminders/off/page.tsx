import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { env } from "@/lib/env";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import { verifyOptOutToken } from "@/lib/reminders/token";
import { cn } from "@/lib/utils";
import { confirmOptOut } from "./actions";

export const metadata: Metadata = { robots: { index: false } };

// Where the opt-out link in a reminder email lands. It works signed out: the
// signed token names the player. Opening the page changes nothing — link
// scanners open every URL in an inbox — the button does.
export default async function RemindersOffPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ t?: string; done?: string; invalid?: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  const t = await getTranslations("remindersOff");
  const { t: token, done, invalid } = await searchParams;

  const valid =
    !invalid &&
    Boolean(
      token && env.reminderSigningSecret && verifyOptOutToken(token, env.reminderSigningSecret),
    );
  const state: "done" | "confirm" | "invalid" = done ? "done" : valid ? "confirm" : "invalid";

  const title =
    state === "done"
      ? t("headline")
      : state === "confirm"
        ? t("confirmHeadline")
        : t("invalidTitle");
  const body =
    state === "done" ? t("body") : state === "confirm" ? t("confirmBody") : t("invalidBody");

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {state === "confirm" ? (
          <form action={confirmOptOut}>
            <input type="hidden" name="t" value={token} />
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className={buttonVariants()}>
              {t("confirm")}
            </button>
          </form>
        ) : null}
        <Link
          href={localePath(locale, "/settings")}
          className={cn(buttonVariants({ variant: state === "confirm" ? "outline" : "default" }))}
        >
          {t("toSettings")}
        </Link>
      </div>
    </main>
  );
}

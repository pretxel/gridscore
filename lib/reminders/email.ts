import { createTranslator } from "next-intl";
import { EMAIL_COLORS, escapeHtml, raw, renderButton, renderEmailShell } from "@/lib/email/layout";
import type { EmailMessage } from "@/lib/email/mailer";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import type { MarketType } from "@/lib/markets";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

// The reminder email: HTML and text built from the app's own message
// catalogues, so it is translated and brand-checked like every other string.
// The HTML goes through the shared shell in lib/email/layout.ts, the same one
// the Supabase Auth templates are generated from.

const MESSAGES = { en, es } as const;

export type ReminderMarket = {
  type: MarketType;
  locksAt: string;
  grandPrixSlug: string;
  grandPrixName: string;
};

export type ReminderInput = {
  to: string;
  locale: string | null;
  timezone: string | null;
  markets: ReminderMarket[];
  siteUrl: string;
  // Absolute URL of the opt-out page for this player (the link in the body).
  optOutUrl: string;
  // Absolute URL a mail client POSTs to for one-click unsubscribe (RFC 8058).
  oneClickUrl: string;
};

function resolveLocale(locale: string | null): Locale {
  return locale && isLocale(locale) ? locale : DEFAULT_LOCALE;
}

// A time zone the runtime knows, else UTC: profiles.timezone is free text.
export function resolveTimeZone(timezone: string | null): string {
  if (!timezone) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

export function formatLockTime(iso: string, locale: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function renderReminderEmail(input: ReminderInput): EmailMessage {
  const locale = resolveLocale(input.locale);
  const timeZone = resolveTimeZone(input.timezone);
  const t = createTranslator({ locale, messages: MESSAGES[locale] });
  const base = input.siteUrl.replace(/\/$/, "");
  const settingsUrl = `${base}${localePath(locale, "/settings")}`;

  // One block per weekend, in lock order.
  const sorted = [...input.markets].sort((a, b) => Date.parse(a.locksAt) - Date.parse(b.locksAt));
  const weekends = new Map<string, { name: string; url: string; lines: string[] }>();
  for (const m of sorted) {
    const entry = weekends.get(m.grandPrixSlug) ?? {
      name: m.grandPrixName,
      url: `${base}${localePath(locale, `/gp/${m.grandPrixSlug}`)}`,
      lines: [],
    };
    entry.lines.push(
      t("reminderEmail.marketLine", {
        market: t(`markets.type.${m.type}`),
        time: formatLockTime(m.locksAt, locale, timeZone),
      }),
    );
    weekends.set(m.grandPrixSlug, entry);
  }

  const count = input.markets.length;
  const subject = t("reminderEmail.subject", { count });
  const heading = t("reminderEmail.heading");
  const intro = t("reminderEmail.intro", { count });
  const cta = t("reminderEmail.cta");
  const why = t("reminderEmail.why");
  const optOut = t("reminderEmail.optOut");
  const settings = t("reminderEmail.settings");

  const text = [
    heading,
    "",
    intro,
    "",
    ...[...weekends.values()].flatMap((w) => [
      w.name,
      ...w.lines.map((l) => `  - ${l}`),
      `  ${cta}: ${w.url}`,
      "",
    ]),
    why,
    `${optOut}: ${input.optOutUrl}`,
    `${settings}: ${settingsUrl}`,
  ].join("\n");

  // One row per weekend: its name, the open markets, and its own button.
  const sections = [...weekends.values()].map((w) =>
    raw(`<tr>
  <td style="padding:22px 32px 0 32px;">
    <p style="margin:0;font-size:16px;font-weight:700;color:${EMAIL_COLORS.ink};">${escapeHtml(w.name)}</p>
    <ul style="margin:8px 0 12px 0;padding-left:18px;color:${EMAIL_COLORS.body};font-size:14px;line-height:1.6;">
      ${w.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("\n      ")}
    </ul>
${renderButton(cta, w.url, { stripe: false })
  .split("\n")
  .map((line) => `    ${line}`)
  .join("\n")}
  </td>
</tr>`),
  );

  // Single-locale: the slot for the other language is never rendered.
  const copy = (value: string) => ({ en: value, es: value });
  const html = renderEmailShell({
    locale,
    kicker: copy(t("reminderEmail.kicker")),
    heading: copy(heading),
    paragraphs: [copy(intro)],
    sections,
    footer: [copy(why)],
    footerLinks: [
      { label: copy(optOut), href: input.optOutUrl },
      { label: copy(settings), href: settingsUrl },
    ],
  });

  return {
    to: input.to,
    subject,
    html,
    text,
    headers: {
      // Mail clients show these as a native unsubscribe button (RFC 8058).
      "List-Unsubscribe": `<${input.oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

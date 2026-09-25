import { createTranslator } from "next-intl";
import type { EmailMessage } from "@/lib/email/mailer";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import type { MarketType } from "@/lib/markets";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

// The reminder email: plain HTML and text built from the app's own message
// catalogues, so it is translated and brand-checked like every other string.

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

  const blocks = [...weekends.values()]
    .map(
      (w) => `
      <tr><td style="padding:16px 0 4px;font-size:16px;font-weight:600;color:#111">${escapeHtml(w.name)}</td></tr>
      <tr><td style="padding:0 0 8px"><ul style="margin:0;padding-left:18px;color:#333;font-size:14px;line-height:1.6">
        ${w.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}
      </ul></td></tr>
      <tr><td style="padding:4px 0 8px"><a href="${escapeHtml(w.url)}" style="display:inline-block;background:#e4572e;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 16px;border-radius:8px">${escapeHtml(cta)}</a></td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="${locale}"><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:12px;padding:24px">
        <tr><td style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#888">gridscore</td></tr>
        <tr><td style="padding-top:8px;font-size:22px;font-weight:700;color:#111">${escapeHtml(heading)}</td></tr>
        <tr><td style="padding-top:8px;font-size:14px;color:#444">${escapeHtml(intro)}</td></tr>
        ${blocks}
        <tr><td style="padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#888;line-height:1.6">
          ${escapeHtml(why)}<br>
          <a href="${escapeHtml(input.optOutUrl)}" style="color:#888">${escapeHtml(optOut)}</a> ·
          <a href="${escapeHtml(settingsUrl)}" style="color:#888">${escapeHtml(settings)}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

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

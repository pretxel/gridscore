import { NextResponse } from "next/server";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/lib/i18n";
import { optOutWithToken } from "@/lib/reminders/opt-out";

// The List-Unsubscribe target. A mail client's one-click button POSTs here
// (RFC 8058) and reminders go off at once. A GET — a person or a link scanner
// following the URL — only lands on the confirmation page, so a scanner that
// prefetches every link in the inbox cannot switch reminders off by itself.

function params(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("l") ?? "";
  return { url, token: url.searchParams.get("t"), locale: isLocale(raw) ? raw : DEFAULT_LOCALE };
}

export async function POST(request: Request) {
  const { token } = params(request);
  const ok = await optOutWithToken(token);
  return new NextResponse(null, { status: ok ? 200 : 400 });
}

export async function GET(request: Request) {
  const { url, token, locale } = params(request);
  const target = new URL(localePath(locale, "/reminders/off"), url.origin);
  if (token) target.searchParams.set("t", token);
  return NextResponse.redirect(target);
}

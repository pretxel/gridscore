import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { env } from "@/lib/env";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/lib/i18n";

const intlMiddleware = createIntlMiddleware({
  locales: SUPPORTED_LOCALES as unknown as string[],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
  localeDetection: true,
});

export async function proxy(request: NextRequest) {
  try {
    // 1. Resolve locale first; may return a redirect for bare paths or
    //    unsupported locale segments.
    const intlResponse = intlMiddleware(request);
    if (intlResponse.headers.get("location")) {
      return intlResponse;
    }

    // 2. Refresh the Supabase session on the response from the i18n middleware
    //    so cookies and rewrites set by next-intl are preserved.
    let response = intlResponse;

    const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          for (const { name, value } of toSet) {
            request.cookies.set(name, value);
          }
          const refreshed = NextResponse.next({ request });
          for (const c of intlResponse.cookies.getAll()) {
            refreshed.cookies.set(c.name, c.value);
          }
          for (const { name, value, options } of toSet) {
            refreshed.cookies.set(name, value, options);
          }
          response = refreshed;
        },
      },
    });

    try {
      await supabase.auth.getUser();
    } catch {
      // Auth refresh can fail (Supabase down, network); never crash the render.
    }
    return response;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|auth|messages|.*\\.).*)"],
};

import { NextResponse } from "next/server";
import { env } from "@/lib/env";

// Shared gate for cron route handlers. Vercel sends `Authorization: Bearer
// $CRON_SECRET` on every scheduled invocation. With no secret configured the
// route runs in non-production (local curl) and is skipped in production.
export function authorizeCron(request: Request): NextResponse | null {
  const auth = request.headers.get("authorization");
  const isProd = process.env.NODE_ENV === "production";
  if (env.cronSecret) {
    if (auth !== `Bearer ${env.cronSecret}`) {
      return new NextResponse("unauthorized", { status: 401 });
    }
    return null;
  }
  if (isProd) return skipped("missing-env");
  return null;
}

export function skipped(reason: string): NextResponse {
  return new NextResponse(null, { status: 204, headers: { "x-skipped": reason } });
}

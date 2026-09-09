function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  // Vercel injects this at runtime for production deployments.
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd}`;
  // Preview / branch deployments expose VERCEL_URL.
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
}

export const env = {
  // Browser code reads the build-time-inlined NEXT_PUBLIC_SUPABASE_URL. Server
  // code prefers a non-public SUPABASE_URL read at runtime so the two can
  // differ (e.g. an in-network origin); on Vercel SUPABASE_URL is unset and
  // both resolve to the same value.
  supabaseUrl:
    process.env.SUPABASE_URL ||
    required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  siteUrl: resolveSiteUrl(),
  // Nullable on purpose: cron routes return 204 with `x-skipped: missing-env`
  // when absent, so a cold environment never crashes the build.
  cronSecret: process.env.CRON_SECRET ?? null,
  // Race data provider endpoint; defaults to the public Jolpica API.
  jolpicaBaseUrl: process.env.JOLPICA_BASE_URL ?? "https://api.jolpi.ca/ergast/f1",
};

export function requireServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

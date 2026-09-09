import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

const nextConfig: NextConfig = {
  // Baseline security headers on every response. Vercel already sends HSTS for
  // the apex domain, so this adds the ones it does not: clickjacking, MIME
  // sniffing, referrer leakage, and unused browser capabilities.
  //
  // No Content-Security-Policy here on purpose: Next injects inline bootstrap
  // scripts, so a CSP needs per-request nonces via the proxy rather than a
  // static header, and a wrong one takes the whole site down.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

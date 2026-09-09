import type { Metadata, Viewport } from "next";
import { Archivo_Black, JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { getLocale } from "next-intl/server";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { env } from "@/lib/env";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

// Heavy editorial grotesque for headings and the wordmark: reads like a
// timing-screen nameplate.
const archivo = Archivo_Black({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = env.siteUrl;
// Root metadata is the static English fallback (covers static routes like
// /_not-found, so it must not touch the DB at build). Per-locale copy is
// applied in [locale]/layout.
const siteName = "gridscore";
const defaultTitle = "gridscore — Grand Prix predictions & live leaderboard";
const defaultDescription =
  "Call pole, podium, fastest lap and more before every session. Points land the moment results are in.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: "%s · gridscore",
  },
  description: defaultDescription,
  applicationName: siteName,
  keywords: [
    "gridscore",
    "grand prix predictions",
    "motorsport prediction game",
    "podium predictor",
    "pole position picks",
    "live leaderboard",
  ],
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["es_ES"],
    url: siteUrl,
    siteName,
    title: defaultTitle,
    description: defaultDescription,
  },
  twitter: {
    card: "summary",
    title: defaultTitle,
    description: defaultDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#121317",
  colorScheme: "dark light",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Tag <html> with the request's resolved locale (the proxy sets it) so es
  // pages are not announced as English to assistive tech and search engines.
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  return (
    <html
      lang={locale}
      dir="ltr"
      suppressHydrationWarning
      className={`${manrope.variable} ${archivo.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
          {children}
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}

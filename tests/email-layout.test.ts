import { describe, expect, it } from "vitest";
import { type EmailShellOptions, raw, renderButton, renderEmailShell } from "@/lib/email/layout";

const base: EmailShellOptions = {
  locale: "bilingual",
  kicker: { en: "Sign in", es: "Iniciar sesión" },
  heading: { en: "Lock in your calls.", es: "Asegura tus predicciones." },
  paragraphs: [{ en: "Tap the button.", es: "Pulsa el botón." }],
  action: { kind: "button", label: { en: "Go", es: "Ir" }, href: "https://example.test/a?b=1&c=2" },
  footer: [{ en: "Footer note.", es: "Nota al pie." }],
};

describe("renderEmailShell", () => {
  it("stacks English then Spanish when bilingual, with lang en", () => {
    const out = renderEmailShell(base);
    expect(out).toContain('<html lang="en">');
    expect(out.indexOf("Tap the button.")).toBeLessThan(out.indexOf("Pulsa el botón."));
    expect(out).toContain("Sign in &middot; Iniciar sesión");
    expect(out).toContain("Go &middot; Ir");
    expect(out).toContain("Lock in your calls.");
    expect(out).not.toContain("Asegura tus predicciones.");
  });

  it("renders only the chosen language in single-locale mode", () => {
    const out = renderEmailShell({ ...base, locale: "es" });
    expect(out).toContain('<html lang="es">');
    expect(out).toContain("Pulsa el botón.");
    expect(out).toContain("Asegura tus predicciones.");
    expect(out).not.toContain("Tap the button.");
    expect(out).not.toContain("Footer note.");
    expect(out).toContain("Predicciones de Grand Prix");
  });

  it("escapes text and attributes", () => {
    const out = renderEmailShell({
      ...base,
      locale: "en",
      heading: { en: "<b>Hi</b>", es: "x" },
    });
    expect(out).toContain("&lt;b&gt;Hi&lt;/b&gt;");
    expect(out).not.toContain("<b>Hi</b>");
    expect(out).toContain('href="https://example.test/a?b=1&amp;c=2"');
  });

  it("passes raw markup through untouched", () => {
    const out = renderEmailShell({
      ...base,
      action: {
        kind: "button",
        label: { en: "Go", es: "Ir" },
        href: raw("{{ .ConfirmationURL }}"),
      },
      linkFallback: raw("{{ .ConfirmationURL }}"),
    });
    expect(out).toContain('href="{{ .ConfirmationURL }}"');
    expect(out).toContain(">{{ .ConfirmationURL }}</a>");
  });

  it("draws every motif without loading anything", () => {
    const out = renderEmailShell({ ...base, linkFallback: "https://example.test" });
    expect(out).toContain('width="10%" height="8"'); // chequered edge
    expect(out).toContain('width="20%" height="5"'); // kerb stripe
    expect(out).toContain(">gridscore</td>");
    expect(out).not.toMatch(/<img|<link|@import|url\(/i);
  });

  it("renders a code block instead of a button", () => {
    const out = renderEmailShell({
      ...base,
      action: { kind: "code", label: { en: "Code", es: "Código" }, code: raw("{{ .Token }}") },
    });
    expect(out).toContain("Code &middot; Código");
    expect(out).toContain("{{ .Token }}</p>");
    expect(out).not.toContain("<a href");
  });
});

describe("renderButton", () => {
  it("adds the kerb stripe unless told not to", () => {
    expect(renderButton("Go", "https://x.test")).toContain('width="20%" height="5"');
    expect(renderButton("Go", "https://x.test", { stripe: false })).not.toContain('height="5"');
  });
});

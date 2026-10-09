// The one email shell. Every email the product sends renders through here:
// the five Supabase Auth templates (generated into supabase/templates/ by
// `pnpm gen:email-templates`) and the app's own mail (lock reminders).
//
// Written for email clients, not browsers: tables for layout, inline styles
// only, no web fonts, no images. Every motorsport motif — the chequered edge,
// the kerb stripe — is drawn with background colours on table cells, so nothing
// has to load, nothing can be blocked by an image-blocking client, and no third
// party's artwork is reproduced.
//
// Plain relative imports with extensions: the generator runs this file
// directly under Node.

import type { Locale } from "../i18n.ts";

// The accent is the app's `signal` token converted from oklch.
const ACCENT = "#E14D28";
const INK = "#18181b";
const BODY = "#3f3f46";
const MUTED = "#71717a";
const FAINT = "#a1a1aa";
const LINE = "#e4e4e7";
const CANVAS = "#f4f4f5";
const PANEL = "#fafafa";
// For callers that render their own section rows.
export const EMAIL_COLORS = { accent: ACCENT, ink: INK, body: BODY, muted: MUTED } as const;
const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO_STACK = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

// ---------------------------------------------------------------------------
// Text and escaping
// ---------------------------------------------------------------------------

// Markup that must reach the output untouched. The only way past escaping, and
// meant for Supabase placeholders such as {{ .ConfirmationURL }} and for
// section rows a caller has already escaped.
export class RawHtml {
  readonly html: string;
  constructor(html: string) {
    this.html = html;
  }
}

export function raw(html: string): RawHtml {
  return new RawHtml(html);
}

export type Text = string | RawHtml;

// One piece of copy in both languages.
export type Copy = { en: Text; es: Text };

// "bilingual" is for Supabase, which serves one template per project, so a
// reader must find their language without us guessing from the address.
export type EmailLocale = Locale | "bilingual";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function html(text: Text): string {
  return text instanceof RawHtml ? text.html : escapeHtml(text);
}

const DOT = " &middot; ";

// Short labels (kicker, button) read "English · Español" on one line.
function joined(copy: Copy, locale: EmailLocale): string {
  if (locale !== "bilingual") return html(copy[locale]);
  return `${html(copy.en)}${DOT}${html(copy.es)}`;
}

// Display text (headline, info lines) shows English when bilingual: stacking
// two headlines reads as noise, and the body copy below carries the Spanish.
function single(copy: Copy, locale: EmailLocale): string {
  return html(locale === "bilingual" ? copy.en : copy[locale]);
}

// Running copy stacks: English, then Spanish in a quieter tone.
function stacked(copy: Copy, locale: EmailLocale): { primary: string; secondary: string | null } {
  if (locale !== "bilingual") return { primary: html(copy[locale]), secondary: null };
  return { primary: html(copy.en), secondary: html(copy.es) };
}

// Copy the shell itself owns.
const SHELL_COPY = {
  linkFallback: {
    en: "If the button does not work, copy this link into your browser.",
    es: "Si el botón no funciona, copia este enlace en tu navegador.",
  },
  strap: {
    en: "Grand Prix predictions · Season leaderboard",
    es: "Predicciones de Grand Prix · Clasificación de la temporada",
  },
} satisfies Record<string, Copy>;

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function indent(block: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return block
    .split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n");
}

function row(padding: string, inner: string): string {
  return `<tr>
  <td style="padding:${padding};">
${indent(inner, 4)}
  </td>
</tr>`;
}

function chequeredEdge(): string {
  const cells = Array.from(
    { length: 10 },
    (_, i) =>
      `      <td width="10%" height="8" style="background-color:${i % 2 === 0 ? INK : LINE};font-size:0;line-height:0;">&nbsp;</td>`,
  ).join("\n");
  return `<tr>
  <td style="padding:0;font-size:0;line-height:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
${cells}
      </tr>
    </table>
  </td>
</tr>`;
}

function wordmark(): string {
  return row(
    "26px 32px 0 32px",
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="background-color:${ACCENT};border-radius:8px;width:32px;height:32px;text-align:center;vertical-align:middle;color:#ffffff;font-size:20px;font-weight:700;line-height:32px;">g</td>
    <td style="padding-left:10px;font-size:20px;font-weight:700;letter-spacing:-0.3px;color:${INK};">gridscore</td>
  </tr>
</table>`,
  );
}

// The kerb stripe that sits under a call to action.
export function kerbStripe(): string {
  const cells = Array.from(
    { length: 5 },
    (_, i) =>
      `    <td width="20%" height="5" style="background-color:${i % 2 === 0 ? ACCENT : CANVAS};font-size:0;line-height:0;">&nbsp;</td>`,
  ).join("\n");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
  <tr>
${cells}
  </tr>
</table>`;
}

// The accent button, full width. Labels and hrefs are escaped unless raw.
export function renderButton(label: Text, href: Text, options: { stripe?: boolean } = {}): string {
  const button = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td align="center" style="background-color:${ACCENT};border-radius:10px;">
      <a href="${html(href)}" style="display:block;padding:15px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
        ${html(label)}
      </a>
    </td>
  </tr>
</table>`;
  return options.stripe === false ? button : `${button}\n${kerbStripe()}`;
}

function codeBlock(label: string, code: Text): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-radius:10px;background-color:${PANEL};">
  <tr>
    <td align="center" style="padding:18px 16px;">
      <p style="margin:0;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:${FAINT};font-weight:600;">${label}</p>
      <p style="margin:8px 0 0 0;font-size:30px;font-weight:700;letter-spacing:7px;color:${INK};font-family:${MONO_STACK};">${html(code)}</p>
    </td>
  </tr>
</table>
${kerbStripe()}`;
}

// ---------------------------------------------------------------------------
// The shell
// ---------------------------------------------------------------------------

export type EmailAction =
  | { kind: "button"; label: Copy; href: Text }
  | { kind: "code"; label: Copy; code: Text };

export type InfoBox = {
  kicker: Copy;
  // Each line: a short accent tag and its text.
  lines: { tag: string; text: Copy }[];
  note: Copy;
};

export type EmailShellOptions = {
  locale: EmailLocale;
  kicker: Copy;
  heading: Copy;
  paragraphs: Copy[];
  action?: EmailAction;
  // A raw link shown under the button for clients that strip buttons.
  linkFallback?: Text;
  infoBox?: InfoBox;
  // Rows the caller rendered and escaped itself, placed after the action.
  sections?: RawHtml[];
  footer: Copy[];
  footerLinks?: { label: Copy; href: Text }[];
  // An HTML comment placed after the doctype (the generated templates use it to
  // say where they come from).
  comment?: string;
};

function textBlock(options: EmailShellOptions): string {
  const { locale } = options;
  const lines = [
    `<p style="margin:0;font-size:11px;letter-spacing:2.2px;text-transform:uppercase;color:${MUTED};font-weight:600;">${joined(options.kicker, locale)}</p>`,
    `<h1 style="margin:8px 0 0 0;font-size:26px;line-height:1.22;font-weight:700;color:${INK};letter-spacing:-0.5px;">${single(options.heading, locale)}</h1>`,
  ];
  options.paragraphs.forEach((copy, i) => {
    const { primary, secondary } = stacked(copy, locale);
    const top = i === 0 ? 14 : 10;
    lines.push(
      `<p style="margin:${top}px 0 0 0;font-size:15px;line-height:1.6;color:${BODY};">${primary}</p>`,
    );
    if (secondary !== null) {
      lines.push(
        `<p style="margin:6px 0 0 0;font-size:15px;line-height:1.6;color:${MUTED};">${secondary}</p>`,
      );
    }
  });
  return row("20px 32px 0 32px", lines.join("\n"));
}

function actionBlock(action: EmailAction, locale: EmailLocale): string {
  const inner =
    action.kind === "button"
      ? renderButton(raw(joined(action.label, locale)), action.href)
      : codeBlock(joined(action.label, locale), action.code);
  return row("24px 32px 0 32px", inner);
}

function fallbackBlock(href: Text, locale: EmailLocale): string {
  const { primary, secondary } = stacked(SHELL_COPY.linkFallback, locale);
  const intro = secondary === null ? primary : `${primary}<br />\n  ${secondary}`;
  return row(
    "18px 32px 0 32px",
    `<p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">
  ${intro}
</p>
<p style="margin:8px 0 0 0;font-size:12px;line-height:1.5;word-break:break-all;">
  <a href="${html(href)}" style="color:${ACCENT};text-decoration:underline;">${html(href)}</a>
</p>`,
  );
}

function infoBlock(box: InfoBox, locale: EmailLocale): string {
  const lines = box.lines
    .map(
      (line) =>
        `<span style="color:${ACCENT};font-weight:700;">${escapeHtml(line.tag)}</span>&nbsp; ${single(line.text, locale)}`,
    )
    .join("<br />\n        ");
  const { primary, secondary } = stacked(box.note, locale);
  const note = secondary === null ? primary : `${primary}<br />\n        ${secondary}`;
  return row(
    "22px 32px 0 32px",
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-radius:10px;background-color:${PANEL};">
  <tr>
    <td style="padding:14px 16px;">
      <p style="margin:0;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:${FAINT};font-weight:600;">${joined(box.kicker, locale)}</p>
      <p style="margin:8px 0 0 0;font-size:13px;line-height:1.7;color:${BODY};">
        ${lines}
      </p>
      <p style="margin:8px 0 0 0;font-size:12px;line-height:1.6;color:${MUTED};">
        ${note}
      </p>
    </td>
  </tr>
</table>`,
  );
}

function footerBlock(options: EmailShellOptions): string {
  const { locale } = options;
  const lines: string[] = [];
  options.footer.forEach((copy, i) => {
    const { primary, secondary } = stacked(copy, locale);
    const top = i === 0 ? "0" : "6px 0 0 0";
    lines.push(
      `<p style="margin:${top};font-size:12px;line-height:1.6;color:${MUTED};">${primary}</p>`,
    );
    if (secondary !== null) {
      lines.push(
        `<p style="margin:6px 0 0 0;font-size:12px;line-height:1.6;color:${FAINT};">${secondary}</p>`,
      );
    }
  });
  if (options.footerLinks?.length) {
    const links = options.footerLinks
      .map(
        (link) =>
          `<a href="${html(link.href)}" style="color:${MUTED};text-decoration:underline;">${joined(link.label, locale)}</a>`,
      )
      .join(DOT);
    lines.push(
      `<p style="margin:10px 0 0 0;font-size:12px;line-height:1.6;color:${MUTED};">${links}</p>`,
    );
  }
  return row(
    "20px 32px 28px 32px",
    `<div style="border-top:1px solid ${LINE};padding-top:16px;">
${indent(lines.join("\n"), 2)}
</div>`,
  );
}

// Renders a complete HTML document for one email.
export function renderEmailShell(options: EmailShellOptions): string {
  const { locale } = options;
  const lang = locale === "bilingual" ? "en" : locale;

  const rows = [chequeredEdge(), wordmark(), textBlock(options)];
  if (options.action) rows.push(actionBlock(options.action, locale));
  if (options.linkFallback !== undefined) rows.push(fallbackBlock(options.linkFallback, locale));
  for (const section of options.sections ?? []) rows.push(section.html);
  if (options.infoBox) rows.push(infoBlock(options.infoBox, locale));
  rows.push(footerBlock(options));

  const card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:0 0 14px 14px;border:1px solid ${LINE};">

${indent(rows.join("\n\n"), 2)}

</table>`;

  const strap = single(SHELL_COPY.strap, locale).replaceAll(" · ", DOT);

  const comment = options.comment ? `<!--\n${options.comment}\n-->\n` : "";

  return `<!doctype html>
${comment}<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
</head>
<body style="margin:0;padding:0;background-color:${CANVAS};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CANVAS};margin:0;padding:32px 12px;font-family:${FONT_STACK};">
  <tr>
    <td align="center">
${indent(card, 6)}

      <p style="margin:16px 0 0 0;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${FAINT};">
        ${strap}
      </p>
    </td>
  </tr>
</table>
</body>
</html>
`;
}

// The five Supabase Auth emails, as data for the shared shell. Their HTML in
// supabase/templates/ is generated from here by `pnpm gen:email-templates`;
// edit this file, never the HTML. Subjects live in supabase/config.toml.
//
// Bilingual on purpose: Supabase serves one template per project and the app
// ships in English and Spanish.

import { type EmailShellOptions, raw, renderEmailShell } from "./layout.ts";

export const SUPABASE_TEMPLATE_NAMES = [
  "magic-link",
  "confirm-signup",
  "invite",
  "email-change",
  "reauthentication",
] as const;

export type SupabaseTemplateName = (typeof SUPABASE_TEMPLATE_NAMES)[number];

// Supabase substitutes these at send time. Do not rename them.
const CONFIRMATION_URL = raw("{{ .ConfirmationURL }}");
const TOKEN = raw("{{ .Token }}");

// Each flow's placeholders, checked by tests/email-templates.test.ts.
export const REQUIRED_PLACEHOLDERS: Record<SupabaseTemplateName, string[]> = {
  "magic-link": ["{{ .ConfirmationURL }}"],
  "confirm-signup": ["{{ .ConfirmationURL }}"],
  invite: ["{{ .ConfirmationURL }}"],
  "email-change": ["{{ .ConfirmationURL }}", "{{ .NewEmail }}"],
  reauthentication: ["{{ .Token }}"],
};

const LINK_EXPIRES = {
  en: "This link expires in one hour and can be used once. If you did not ask for it, ignore this email.",
  es: "Este enlace caduca en una hora y solo sirve una vez. Si no lo has pedido, ignora este correo.",
};

// The game in two lines, for the emails that bring someone in.
const YOUR_CALLS = {
  kicker: { en: "Your calls", es: "Tus predicciones" },
  lines: [
    {
      tag: "P1",
      text: { en: "Pole · Podium · Fastest lap", es: "Pole · Podio · Vuelta rápida" },
    },
    {
      tag: "P2",
      text: { en: "First retirement · Safety car", es: "Primer abandono · Coche de seguridad" },
    },
  ],
  note: {
    en: "Each call locks when its session starts.",
    es: "Cada predicción se cierra al empezar su sesión.",
  },
};

type Template = {
  title: string;
  options: Omit<EmailShellOptions, "locale" | "comment">;
};

const TEMPLATES: Record<SupabaseTemplateName, Template> = {
  "magic-link": {
    title: "Magic-link email.",
    options: {
      kicker: { en: "Sign in", es: "Iniciar sesión" },
      heading: { en: "Lock in your calls.", es: "Asegura tus predicciones." },
      paragraphs: [
        {
          en: "Tap the button to sign in. No password needed.",
          es: "Pulsa el botón para entrar. No hace falta contraseña.",
        },
      ],
      action: { kind: "button", label: { en: "Sign in", es: "Entrar" }, href: CONFIRMATION_URL },
      linkFallback: CONFIRMATION_URL,
      infoBox: YOUR_CALLS,
      footer: [LINK_EXPIRES],
    },
  },
  "confirm-signup": {
    title: "Sign-up confirmation email.",
    options: {
      kicker: { en: "Confirm", es: "Confirmar" },
      heading: { en: "Confirm your email.", es: "Confirma tu email." },
      paragraphs: [
        {
          en: "One tap and your account is ready.",
          es: "Un toque y tu cuenta queda lista.",
        },
      ],
      action: {
        kind: "button",
        label: { en: "Confirm", es: "Confirmar" },
        href: CONFIRMATION_URL,
      },
      linkFallback: CONFIRMATION_URL,
      infoBox: YOUR_CALLS,
      footer: [LINK_EXPIRES],
    },
  },
  invite: {
    title: "Invite email.",
    options: {
      kicker: { en: "Invitation", es: "Invitación" },
      heading: { en: "You have been invited.", es: "Te han invitado." },
      paragraphs: [
        {
          en: "Accept the invitation to pick up your account and start calling race weekends.",
          es: "Acepta la invitación para activar tu cuenta y empezar a predecir los fines de semana de carrera.",
        },
      ],
      action: { kind: "button", label: { en: "Accept", es: "Aceptar" }, href: CONFIRMATION_URL },
      linkFallback: CONFIRMATION_URL,
      infoBox: YOUR_CALLS,
      footer: [
        {
          en: "If you were not expecting this invitation, ignore this email.",
          es: "Si no esperabas esta invitación, ignora este correo.",
        },
      ],
    },
  },
  "email-change": {
    title: "Email change email.",
    options: {
      kicker: { en: "Email change", es: "Cambio de email" },
      heading: { en: "Confirm the new address.", es: "Confirma la nueva dirección." },
      paragraphs: [
        {
          en: raw(
            "Your account is moving to <strong>{{ .NewEmail }}</strong>. Confirm to finish. Until you do, the old address keeps working.",
          ),
          es: raw(
            "Tu cuenta pasa a <strong>{{ .NewEmail }}</strong>. Confirma para terminar. Hasta entonces, la dirección anterior sigue funcionando.",
          ),
        },
      ],
      action: {
        kind: "button",
        label: { en: "Confirm", es: "Confirmar" },
        href: CONFIRMATION_URL,
      },
      linkFallback: CONFIRMATION_URL,
      footer: [
        {
          en: "If you did not ask to change your email, ignore this message and tell the site owner.",
          es: "Si no has pedido cambiar tu email, ignora este mensaje y avisa al propietario del sitio.",
        },
      ],
    },
  },
  reauthentication: {
    title: "Reauthentication email.",
    options: {
      kicker: { en: "Confirm it is you", es: "Confirma que eres tú" },
      heading: { en: "Your confirmation code.", es: "Tu código de confirmación." },
      paragraphs: [
        {
          en: "Enter this code to confirm the change you just asked for.",
          es: "Introduce este código para confirmar el cambio que acabas de pedir.",
        },
      ],
      action: { kind: "code", label: { en: "Code", es: "Código" }, code: TOKEN },
      footer: [
        {
          en: "The code expires in one hour. If you did not ask for it, ignore this email.",
          es: "El código caduca en una hora. Si no lo has pedido, ignora este correo.",
        },
      ],
    },
  },
};

function headerComment(name: SupabaseTemplateName): string {
  return `  ${TEMPLATES[name].title}

  GENERATED by \`pnpm gen:email-templates\` from lib/email/templates.ts and the
  shared shell in lib/email/layout.ts. Do not edit this file by hand: change
  the source and regenerate. tests/email-templates.test.ts fails when stale.

  Supabase fills in: ${REQUIRED_PLACEHOLDERS[name].map((p) => p.replace(/[{} ]/g, "")).join(", ")}.`;
}

export function renderSupabaseTemplate(name: SupabaseTemplateName): string {
  return renderEmailShell({
    ...TEMPLATES[name].options,
    locale: "bilingual",
    comment: headerComment(name),
  });
}

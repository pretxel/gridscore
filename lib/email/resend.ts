import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import type { EmailMessage, Mailer, SendResult } from "./mailer";

// The production Mailer. Resend accepts a send once it returns an id; any
// error (bad key, unverified domain, rate limit) comes back as `error`.
export function resendMailer(
  apiKey: string | null = env.resendApiKey,
  from: string | null = env.reminderFromEmail,
): Mailer {
  const client = apiKey ? new Resend(apiKey) : null;
  return {
    available: () => client !== null && Boolean(from),
    async send(message: EmailMessage): Promise<SendResult> {
      if (!client || !from) return { ok: false, error: "resend is not configured" };
      try {
        const { data, error } = await client.emails.send({
          from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          headers: message.headers,
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true, id: data?.id ?? null };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}

// Outgoing email behind an interface, like the race-data provider: the
// reminder job takes a Mailer, production passes the Resend one, tests pass a
// fake that records what would have been sent.

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

export interface Mailer {
  // Whether the mailer is configured; the job skips with `missing-env` if not.
  available(): boolean;
  send(message: EmailMessage): Promise<SendResult>;
}

import { z } from "zod";

export const REMINDER_LEADS = ["24h", "2h", "off"] as const;
export type ReminderLead = (typeof REMINDER_LEADS)[number];

// No row in reminder_preferences means this.
export const DEFAULT_REMINDER_LEAD: ReminderLead = "24h";

export const reminderLeadSchema = z.enum(REMINDER_LEADS);

export function isReminderLead(value: unknown): value is ReminderLead {
  return reminderLeadSchema.safeParse(value).success;
}

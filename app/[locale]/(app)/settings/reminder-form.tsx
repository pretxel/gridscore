"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { REMINDER_LEADS, type ReminderLead } from "@/lib/reminders/preferences";
import { cn } from "@/lib/utils";
import { saveReminderPreference } from "./actions";

const LABEL_KEY: Record<ReminderLead, "lead24h" | "lead2h" | "leadOff"> = {
  "24h": "lead24h",
  "2h": "lead2h",
  off: "leadOff",
};

export function ReminderForm({ initial, locale }: { initial: ReminderLead; locale: string }) {
  const t = useTranslations("settings");
  const [saved, setSaved] = React.useState<ReminderLead>(initial);
  const [lead, setLead] = React.useState<ReminderLead>(initial);
  const [pending, startTransition] = React.useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveReminderPreference(fd);
      if (res.ok) {
        setSaved(lead);
        toast.success(t("saved"));
      } else {
        toast.error(t("error"));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <fieldset className="grid gap-2">
        <legend className="sr-only">{t("remindersTitle")}</legend>
        {REMINDER_LEADS.map((value) => (
          <label
            key={value}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
              lead === value ? "border-signal bg-signal/10" : "border-border hover:bg-muted/50",
            )}
          >
            <input
              type="radio"
              name="lead"
              value={value}
              checked={lead === value}
              onChange={() => setLead(value)}
              className="accent-[var(--signal)]"
            />
            {t(LABEL_KEY[value])}
          </label>
        ))}
      </fieldset>
      <div>
        <Button type="submit" disabled={pending || lead === saved}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

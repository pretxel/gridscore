"use client";

import { CheckCircle2Icon, Loader2Icon, MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function SignInForm({ next }: { next?: string }) {
  const t = useTranslations("signIn");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const redirectTo = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback${
    next ? `?next=${encodeURIComponent(next)}` : ""
  }`;

  function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error(t("invalidEmail"));
      return;
    }
    startTransition(async () => {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-signal/30 bg-signal/5 p-4 text-sm dark:bg-signal/10">
        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-signal" />
        <div>
          <p className="font-medium">{t("checkInbox")}</p>
          <p className="mt-1 text-muted-foreground">
            {t.rich("checkInboxBody", {
              email: () => <span className="font-mono text-foreground">{email}</span>,
            })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleMagicLink} className="space-y-3">
        <div className="space-y-1.5">
          <Label
            htmlFor="email"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
          >
            {t("emailLabel")}
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className="h-11 text-base"
          />
        </div>
        <Button
          type="submit"
          disabled={isPending}
          className="h-11 w-full gap-2 text-sm font-semibold uppercase tracking-[0.14em]"
        >
          {isPending ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> {t("sending")}
            </>
          ) : (
            <>
              <MailIcon className="size-4" /> {t("send")}
            </>
          )}
        </Button>
      </form>
    </div>
  );
}

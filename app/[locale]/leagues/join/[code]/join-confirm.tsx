"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { joinLeagueAction } from "@/app/[locale]/(app)/leagues/actions";
import { Button } from "@/components/ui/button";

export function JoinConfirm({
  code,
  leaguesPath,
  disabled,
}: {
  code: string;
  leaguesPath: string;
  disabled?: boolean;
}) {
  const t = useTranslations("leagueInvite");
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function join() {
    setError(null);
    startTransition(async () => {
      const res = await joinLeagueAction({ code });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(t("joinedToast"));
      router.push(`${leaguesPath}/${res.leagueId}`);
    });
  }

  return (
    <div className="grid gap-3">
      <Button type="button" size="lg" onClick={join} disabled={pending || disabled}>
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        {t("join")}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEAGUE_NAME_MAX, LEAGUE_NAME_MIN } from "@/lib/league-form";
import { createLeagueAction, joinLeagueAction } from "./actions";

// Create + join, side by side. Both call a server action and navigate to the
// league on success; refusals from the database surface inline.
export function LeagueForms({ leaguesPath }: { leaguesPath: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CreateLeagueForm leaguesPath={leaguesPath} />
      <JoinLeagueForm leaguesPath={leaguesPath} />
    </div>
  );
}

function CreateLeagueForm({ leaguesPath }: { leaguesPath: string }) {
  const t = useTranslations("leagues");
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createLeagueAction({ name });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(t("createdToast"));
      router.push(`${leaguesPath}/${res.leagueId}`);
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-labelledby="create-league-title"
    >
      <div>
        <h2 id="create-league-title" className="font-heading text-base font-semibold">
          {t("createTitle")}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("createLede")}</p>
      </div>
      <div className="space-y-1.5">
        <Label
          htmlFor="league-name"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
        >
          {t("nameLabel")}
        </Label>
        <Input
          id="league-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={LEAGUE_NAME_MIN}
          maxLength={LEAGUE_NAME_MAX}
          placeholder={t("namePlaceholder")}
          autoComplete="off"
          className="h-10"
          aria-invalid={error ? true : undefined}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || name.trim().length < LEAGUE_NAME_MIN}>
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        {t("createButton")}
      </Button>
    </form>
  );
}

function JoinLeagueForm({ leaguesPath }: { leaguesPath: string }) {
  const t = useTranslations("leagues");
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
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
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-labelledby="join-league-title"
    >
      <div>
        <h2 id="join-league-title" className="font-heading text-base font-semibold">
          {t("joinTitle")}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("joinLede")}</p>
      </div>
      <div className="space-y-1.5">
        <Label
          htmlFor="join-code"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
        >
          {t("codeLabel")}
        </Label>
        <Input
          id="join-code"
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          placeholder="GP-XXXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="h-10 font-mono uppercase tracking-[0.12em]"
          aria-invalid={error ? true : undefined}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending || code.trim().length < 5}>
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        {t("joinButton")}
      </Button>
    </form>
  );
}

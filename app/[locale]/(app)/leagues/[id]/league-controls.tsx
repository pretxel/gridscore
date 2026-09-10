"use client";

import { Loader2Icon, LogOutIcon, PencilIcon, Trash2Icon, UserXIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEAGUE_NAME_MAX, LEAGUE_NAME_MIN } from "@/lib/league-form";
import {
  deleteLeagueAction,
  leaveLeagueAction,
  removeMemberAction,
  renameLeagueAction,
} from "../actions";

// Owner: rename + delete. Member: leave. Every destructive step goes through
// an in-app dialog, never window.confirm.
export function LeagueControls({
  leagueId,
  name,
  isOwner,
  leaguesPath,
}: {
  leagueId: string;
  name: string;
  isOwner: boolean;
  leaguesPath: string;
}) {
  const t = useTranslations("leagues");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function leave() {
    startTransition(async () => {
      const res = await leaveLeagueAction({ leagueId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("leftToast"));
      router.push(leaguesPath);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteLeagueAction({ leagueId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("deletedToast"));
      router.push(leaguesPath);
    });
  }

  if (!isOwner) {
    return (
      <ConfirmDialog
        trigger={
          <Button type="button" variant="outline" size="sm" disabled={pending}>
            <LogOutIcon />
            {t("leave")}
          </Button>
        }
        title={t("leaveTitle")}
        body={t("leaveBody", { name })}
        confirmLabel={t("leave")}
        cancelLabel={t("cancel")}
        pending={pending}
        onConfirm={leave}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <RenameDialog leagueId={leagueId} name={name} />
      <ConfirmDialog
        trigger={
          <Button type="button" variant="destructive" size="sm" disabled={pending}>
            <Trash2Icon />
            {t("delete")}
          </Button>
        }
        title={t("deleteTitle")}
        body={t("deleteBody", { name })}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        pending={pending}
        onConfirm={remove}
        destructive
      />
    </div>
  );
}

function RenameDialog({ leagueId, name }: { leagueId: string; name: string }) {
  const t = useTranslations("leagues");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(name);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await renameLeagueAction({ leagueId, name: value });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(t("renamedToast"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValue(name);
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <PencilIcon />
        {t("rename")}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t("renameTitle")}</DialogTitle>
            <DialogDescription>{t("renameBody")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rename-league" className="sr-only">
              {t("nameLabel")}
            </Label>
            <Input
              id="rename-league"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              minLength={LEAGUE_NAME_MIN}
              maxLength={LEAGUE_NAME_MAX}
              autoComplete="off"
              aria-invalid={error ? true : undefined}
            />
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" disabled={pending || value.trim().length < LEAGUE_NAME_MIN}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Owner-only: removes one member from the roster.
export function RemoveMemberButton({
  leagueId,
  userId,
  displayName,
}: {
  leagueId: string;
  userId: string;
  displayName: string;
}) {
  const t = useTranslations("leagues");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function remove() {
    startTransition(async () => {
      const res = await removeMemberAction({ leagueId, userId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("removedToast", { name: displayName }));
      router.refresh();
    });
  }

  return (
    <ConfirmDialog
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("removeMember", { name: displayName })}
          disabled={pending}
        >
          <UserXIcon />
        </Button>
      }
      title={t("removeTitle")}
      body={t("removeBody", { name: displayName })}
      confirmLabel={t("remove")}
      cancelLabel={t("cancel")}
      pending={pending}
      onConfirm={remove}
      destructive
    />
  );
}

function ConfirmDialog({
  trigger,
  title,
  body,
  confirmLabel,
  cancelLabel,
  pending,
  onConfirm,
  destructive,
}: {
  trigger: React.ReactElement;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  pending: boolean;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="ghost" />}>{cancelLabel}</DialogClose>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

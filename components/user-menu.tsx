"use client";

import { Popover } from "@base-ui/react/popover";
import { CheckIcon, LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { updateDisplayName } from "@/app/[locale]/profile-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function initialOf(name: string | null, email: string): string {
  const src = (name?.trim() || email).trim();
  return (src[0] ?? "?").toUpperCase();
}

// Top-right account menu for signed-in users: identity, inline display-name
// edit (saved without leaving the page), and sign out.
export function UserMenu({
  displayName,
  email,
  signOutPath,
}: {
  displayName: string | null;
  email: string;
  signOutPath: string;
}) {
  const t = useTranslations("profileMenu");
  const tCommon = useTranslations("common");
  const [name, setName] = React.useState(displayName ?? "");
  const [value, setValue] = React.useState(displayName ?? "");
  const [pending, startTransition] = React.useTransition();
  const fieldId = React.useId();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateDisplayName(fd);
      if (res.ok) {
        setName(res.displayName);
        setValue(res.displayName);
        toast.success(t("saved"));
      } else {
        toast.error(t(res.error === "invalid" ? "invalid" : "error"));
      }
    });
  }

  const dirty = value.trim() !== name.trim();

  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("openMenu")}
            className="rounded-full"
          />
        }
      >
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-full bg-signal/15 font-heading text-xs font-semibold text-signal"
        >
          {initialOf(name, email)}
        </span>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Popover.Popup className="w-72 rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal/15 font-heading text-sm font-semibold text-signal"
              >
                {initialOf(name, email)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {name.trim() || t("account")}
                </p>
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="mt-3 space-y-2">
              <Label htmlFor={fieldId} className="text-xs text-muted-foreground">
                {t("nameLabel")}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id={fieldId}
                  name="display_name"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  minLength={2}
                  maxLength={32}
                  autoComplete="off"
                  className="h-8"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={pending || !dirty || value.trim().length < 2}
                >
                  <CheckIcon className={cn(pending && "animate-pulse")} />
                  {t("save")}
                </Button>
              </div>
            </form>

            <form action={signOutPath} method="post" className="mt-3 border-t border-border pt-3">
              <Button type="submit" variant="outline" size="sm" className="w-full">
                <LogOutIcon />
                {tCommon("signOut")}
              </Button>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

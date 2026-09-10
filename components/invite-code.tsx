"use client";

import { CheckIcon, CopyIcon, Share2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InviteCodeLabels = {
  code: string;
  copyCode: string;
  copyLink: string;
  share: string;
  copied: string;
  shareTitle: string;
  shareText: string;
};

// Join code with copy / share controls. The invite link is built from the
// current origin so it works on previews and production alike.
export function InviteCode({
  code,
  joinPath,
  labels,
  className,
}: {
  code: string;
  joinPath: string;
  labels: InviteCodeLabels;
  className?: string;
}) {
  const [copied, setCopied] = React.useState<"code" | "link" | null>(null);
  const [canShare, setCanShare] = React.useState(false);

  React.useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const inviteUrl = () =>
    typeof window === "undefined" ? joinPath : `${window.location.origin}${joinPath}`;

  async function copy(kind: "code" | "link") {
    const value = kind === "code" ? code : inviteUrl();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      toast.success(labels.copied);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error(value);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: labels.shareTitle, text: labels.shareText, url: inviteUrl() });
    } catch {
      // Cancelled by the user: nothing to report.
    }
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {labels.code}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <output
          className="rounded-md bg-muted px-3 py-1.5 font-mono text-xl font-semibold tracking-[0.18em]"
          data-testid="join-code"
        >
          {code}
        </output>
        <Button type="button" variant="outline" size="sm" onClick={() => copy("code")}>
          {copied === "code" ? <CheckIcon /> : <CopyIcon />}
          {labels.copyCode}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => copy("link")}>
          {copied === "link" ? <CheckIcon /> : <CopyIcon />}
          {labels.copyLink}
        </Button>
        {canShare ? (
          <Button type="button" variant="outline" size="sm" onClick={share}>
            <Share2Icon />
            {labels.share}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

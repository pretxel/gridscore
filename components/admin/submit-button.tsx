"use client";

import { Loader2Icon } from "lucide-react";
import * as React from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// The shared pending-aware submit pattern for admin Server Action forms.
//
// All admin actions take `(formData: FormData)` and redirect/revalidate, so
// `useActionState` (which would call `action(prevState, formData)`) is not used
// — it would require changing every action signature, which is out of scope for
// this presentation-only redesign. Instead this reads pending state from the
// enclosing <form> via `useFormStatus`, disables + shows a spinner while the
// action runs, and optionally gates submission behind a confirm() for
// destructive/irreversible actions (resend, set-active). Outcome feedback is
// rendered separately via <ActionStatus> from the action's query-param result.
//
// Usage: <form action={serverAction}><SubmitButton>Save</SubmitButton></form>
type ButtonProps = React.ComponentProps<typeof Button>;

export function SubmitButton({
  children,
  pendingLabel,
  confirmText,
  disabled,
  onClick,
  ...props
}: ButtonProps & {
  pendingLabel?: React.ReactNode;
  confirmText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      onClick={(event) => {
        if (confirmText && !window.confirm(confirmText)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...props}
    >
      {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

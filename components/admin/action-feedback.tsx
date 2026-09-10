import { getTranslations } from "next-intl/server";
import { ActionStatus } from "@/components/admin/action-status";
import { LiveRegion } from "@/components/admin/live-region";

// Renders the outcome an admin action put in the query string. Every action
// redirects back with `?ok=<key>` or `?error=<key>[&detail=…]`, so the page
// stays a plain server component and the result survives a refresh.
//
// The panel is mounted only after the redirect, so announcing is delegated to
// the always-present <LiveRegion>.
export async function AdminActionFeedback({
  ok,
  error,
  detail,
}: {
  ok?: string;
  error?: string;
  detail?: string;
}) {
  const t = await getTranslations("admin");
  const okMessage = ok ? t(`result.${ok}` as never) : null;
  const errorMessage = error ? t(`error.${error}` as never) : null;

  return (
    <>
      <LiveRegion status={okMessage} alert={errorMessage} />
      {okMessage ? (
        <ActionStatus variant="success" live={false}>
          {okMessage}
        </ActionStatus>
      ) : null}
      {errorMessage ? (
        <ActionStatus variant="error" live={false}>
          {errorMessage}
          {detail ? (
            <span className="mt-1 block font-mono text-xs opacity-80">{detail}</span>
          ) : null}
        </ActionStatus>
      ) : null}
    </>
  );
}

// Narrows the loose `searchParams` shape into the three values above.
export function feedbackFrom(params: Record<string, string | string[] | undefined>): {
  ok?: string;
  error?: string;
  detail?: string;
} {
  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : (value ?? undefined);
  return { ok: one(params.ok), error: one(params.error), detail: one(params.detail) };
}

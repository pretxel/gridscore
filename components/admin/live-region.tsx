// Always-mounted, visually-hidden live regions. The admin action results render
// only after a server redirect (matches sync/resend, quiz resend), so a live
// region created together with its text is not reliably announced — a region
// must already exist in the DOM and have its CONTENTS change. Rendering both a
// polite and an assertive region unconditionally (outside the page's reveal
// container) guarantees outcomes are spoken when their text appears.
export function LiveRegion({
  status,
  alert,
}: {
  status?: React.ReactNode;
  alert?: React.ReactNode;
}) {
  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {status}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {alert}
      </div>
    </>
  );
}

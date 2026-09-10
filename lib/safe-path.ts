// Only same-origin absolute paths may be used as a post-sign-in destination:
// anything scheme-like or protocol-relative would turn `?next=` into an open
// redirect.
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw;
}

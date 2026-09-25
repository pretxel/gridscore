import { createHmac, timingSafeEqual } from "node:crypto";

// The one-click opt-out link identifies the player without a sign-in:
// base64url(user id) + "." + base64url(HMAC-SHA256(user id)). No expiry, so a
// link in an old email still works. Changing the secret invalidates every
// link already sent.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mac(userId: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(userId).digest();
}

export function signOptOutToken(userId: string, secret: string): string {
  return `${Buffer.from(userId).toString("base64url")}.${mac(userId, secret).toString("base64url")}`;
}

// The user id the token was signed for, or null when it is malformed or was
// not signed with this secret.
export function verifyOptOutToken(token: string, secret: string): string | null {
  const [idPart, macPart, ...rest] = token.split(".");
  if (!idPart || !macPart || rest.length > 0) return null;
  const userId = Buffer.from(idPart, "base64url").toString("utf8");
  if (!UUID.test(userId)) return null;
  const given = Buffer.from(macPart, "base64url");
  const expected = mac(userId, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return userId;
}

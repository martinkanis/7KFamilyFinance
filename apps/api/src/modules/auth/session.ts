import { createHmac, timingSafeEqual } from "node:crypto";

// Bezstavová session: base64url(JSON {u, exp}) + "." + HMAC-SHA256 podpis.

export const SESSION_COOKIE = "kkff_session";

interface SessionPayload {
  u: string;
  exp: number;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(
  username: string,
  secret: string,
  expiresAt: Date,
): string {
  const payload: SessionPayload = { u: username, exp: expiresAt.getTime() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

function hasValidSignature(
  encoded: string,
  signature: string,
  secret: string,
): boolean {
  const encoder = new TextEncoder();
  const expected = encoder.encode(sign(encoded, secret));
  const actual = encoder.encode(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function decodePayload(encoded: string): SessionPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString());
    const isPayload =
      typeof parsed?.u === "string" && typeof parsed?.exp === "number";
    return isPayload ? parsed : null;
  } catch {
    return null;
  }
}

/** Vrátí uživatele z platného a neprošlého tokenu, jinak null. */
export function verifySessionToken(
  token: string,
  secret: string,
  now: Date,
): string | null {
  const [encoded, signature, ...rest] = token.split(".");
  if (!encoded || !signature || rest.length > 0) {
    return null;
  }
  if (!hasValidSignature(encoded, signature, secret)) {
    return null;
  }
  const payload = decodePayload(encoded);
  if (!payload || payload.exp <= now.getTime()) {
    return null;
  }
  return payload.u;
}

export function readCookie(
  cookieHeader: string | null,
  name: string,
): string | null {
  for (const part of cookieHeader?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      return value.join("=");
    }
  }
  return null;
}

export function serializeSessionCookie(options: {
  token: string;
  maxAgeSeconds: number;
  secure: boolean;
}): string {
  const attributes = [
    `${SESSION_COOKIE}=${options.token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${options.maxAgeSeconds}`,
  ];
  if (options.secure) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

export function serializeClearedSessionCookie(secure: boolean): string {
  return serializeSessionCookie({ token: "", maxAgeSeconds: 0, secure });
}

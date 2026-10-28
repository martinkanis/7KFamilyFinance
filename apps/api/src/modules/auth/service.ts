import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { config } from "../../config.ts";
import { db } from "../../db/index.ts";
import { serverSecrets } from "../../db/schema.ts";
import {
  createSessionToken,
  readCookie,
  SESSION_COOKIE,
  serializeClearedSessionCookie,
  serializeSessionCookie,
  verifySessionToken,
} from "./session.ts";
import { parseAuthUsers } from "./users.ts";

const SESSION_SECRET_NAME = "session";
const SECONDS_PER_DAY = 24 * 60 * 60;

// Chybný AUTH_USERS shodí start aplikace – lepší než tiše nikoho nepustit.
const users = parseAuthUsers(config.authUsers);

let cachedSecret: string | null = null;
let dummyHash: Promise<string> | null = null;

export function configuredUserCount(): number {
  return users.size;
}

/** Tajemství z env, jinak jednou vygenerované a uložené v DB (přežije redeploy). */
async function getSessionSecret(): Promise<string> {
  if (config.sessionSecret) {
    return config.sessionSecret;
  }
  if (cachedSecret) {
    return cachedSecret;
  }
  await db
    .insert(serverSecrets)
    .values({
      name: SESSION_SECRET_NAME,
      value: randomBytes(32).toString("base64url"),
    })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(serverSecrets)
    .where(eq(serverSecrets.name, SESSION_SECRET_NAME));
  if (!row) {
    throw new Error("Tajemství pro session se nepodařilo uložit ani načíst");
  }
  cachedSecret = row.value;
  return cachedSecret;
}

function getDummyHash(): Promise<string> {
  dummyHash ??= Bun.password.hash(randomBytes(16).toString("hex"));
  return dummyHash;
}

/** Ověří jméno a heslo; u neznámého jména ověřuje proti falešnému hashi (stejná doba odpovědi). */
export async function verifyCredentials(
  username: string,
  password: string,
): Promise<string | null> {
  const normalized = username.trim().toLowerCase();
  const hash = users.get(normalized);
  const matches = await Bun.password.verify(
    password,
    hash ?? (await getDummyHash()),
  );
  return hash && matches ? normalized : null;
}

/** Přihlášený uživatel z cookie; odebraný uživatel z AUTH_USERS přístup ztrácí. */
export async function authenticate(request: Request): Promise<string | null> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token) {
    return null;
  }
  const username = verifySessionToken(
    token,
    await getSessionSecret(),
    new Date(),
  );
  return username && users.has(username) ? username : null;
}

export async function createLoginCookie(username: string): Promise<string> {
  const maxAgeSeconds = config.sessionMaxAgeDays * SECONDS_PER_DAY;
  const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);
  const token = createSessionToken(
    username,
    await getSessionSecret(),
    expiresAt,
  );
  return serializeSessionCookie({
    token,
    maxAgeSeconds,
    secure: config.isProduction,
  });
}

export function createLogoutCookie(): string {
  return serializeClearedSessionCookie(config.isProduction);
}

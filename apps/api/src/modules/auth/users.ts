// AUTH_USERS = "martin:<base64 hash>,eva:<base64 hash>".
// Hash je v base64, aby `$` z Argon2 nerozbilo načítání .env ani proměnné v deployi.

export type UserHashes = Map<string, string>;

export class InvalidAuthUsersError extends Error {
  constructor(entry: string) {
    super(
      `AUTH_USERS: položka „${entry.slice(0, 20)}…“ nemá tvar jmeno:hash (hash vygeneruje bun run auth:hash-password)`,
    );
  }
}

export function encodePasswordHash(hash: string): string {
  return Buffer.from(hash).toString("base64");
}

export function parseAuthUsers(raw: string): UserHashes {
  const users: UserHashes = new Map();
  for (const entry of raw.split(",").map((part) => part.trim())) {
    if (entry === "") {
      continue;
    }
    const separator = entry.indexOf(":");
    const username = entry.slice(0, separator).trim().toLowerCase();
    const encodedHash = entry.slice(separator + 1).trim();
    if (separator <= 0 || encodedHash === "") {
      throw new InvalidAuthUsersError(entry);
    }
    users.set(username, Buffer.from(encodedHash, "base64").toString());
  }
  return users;
}

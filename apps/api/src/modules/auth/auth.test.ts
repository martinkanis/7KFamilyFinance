import { describe, expect, it } from "bun:test";
import { LoginRateLimiter } from "./rateLimit.ts";
import {
  createSessionToken,
  readCookie,
  verifySessionToken,
} from "./session.ts";
import { encodePasswordHash, parseAuthUsers } from "./users.ts";

const SECRET = "test-secret";
const NOW = new Date("2026-11-01T10:00:00Z");
const LATER = new Date("2026-11-02T10:00:00Z");

describe("session token", () => {
  it("ověří vlastní platný token", () => {
    const token = createSessionToken("martin", SECRET, LATER);
    expect(verifySessionToken(token, SECRET, NOW)).toBe("martin");
  });

  it("odmítne prošlý, cizím klíčem podepsaný nebo upravený token", () => {
    const token = createSessionToken("martin", SECRET, LATER);
    expect(verifySessionToken(token, SECRET, LATER)).toBeNull();
    expect(verifySessionToken(token, "jiny-klic", NOW)).toBeNull();

    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ u: "eva", exp: LATER.getTime() }),
    ).toString("base64url");
    expect(
      verifySessionToken(`${forged}.${signature}`, SECRET, NOW),
    ).toBeNull();
    expect(verifySessionToken("nesmysl", SECRET, NOW)).toBeNull();
  });

  it("přečte cookie z hlavičky", () => {
    expect(readCookie("a=1; kkff_session=abc.def; b=2", "kkff_session")).toBe(
      "abc.def",
    );
    expect(readCookie(null, "kkff_session")).toBeNull();
  });
});

describe("AUTH_USERS", () => {
  it("dekóduje uživatele a hashe", () => {
    const hash = "$argon2id$v=19$m=65536,t=2,p=1$abc$def";
    const users = parseAuthUsers(
      `Martin:${encodePasswordHash(hash)}, eva:${encodePasswordHash("x")}`,
    );
    expect(users.get("martin")).toBe(hash);
    expect(users.get("eva")).toBe("x");
  });

  it("prázdná hodnota = nikdo se nepřihlásí, chybný tvar je chyba", () => {
    expect(parseAuthUsers("").size).toBe(0);
    expect(() => parseAuthUsers("jenjmeno")).toThrow();
  });
});

describe("omezení přihlášení", () => {
  it("zablokuje po limitu neúspěchů a po okně pustí", () => {
    const limiter = new LoginRateLimiter(2, 1000);
    limiter.recordFailure("ip|martin", 0);
    expect(limiter.isBlocked("ip|martin", 10)).toBe(false);
    limiter.recordFailure("ip|martin", 20);
    expect(limiter.isBlocked("ip|martin", 30)).toBe(true);
    expect(limiter.isBlocked("ip|martin", 1001)).toBe(false);
  });
});

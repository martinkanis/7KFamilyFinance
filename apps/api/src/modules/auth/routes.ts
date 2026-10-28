import { Elysia, t } from "elysia";
import type { CurrentUser } from "../../contracts.ts";
import { HttpError } from "../../lib/errors.ts";
import { LoginRateLimiter } from "./rateLimit.ts";
import {
  authenticate,
  createLoginCookie,
  createLogoutCookie,
  verifyCredentials,
} from "./service.ts";

const MAX_FAILED_LOGINS = 5;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;

const limiter = new LoginRateLimiter(MAX_FAILED_LOGINS, FAILED_LOGIN_WINDOW_MS);

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

const loginBody = t.Object({
  username: t.String({ minLength: 1, maxLength: 100 }),
  password: t.String({ minLength: 1, maxLength: 200 }),
});

export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .post(
    "/login",
    async ({ body, request, set }): Promise<CurrentUser> => {
      const limitKey = `${clientIp(request)}|${body.username.toLowerCase()}`;
      if (limiter.isBlocked(limitKey, Date.now())) {
        throw new HttpError(429, "Příliš mnoho pokusů, zkus to za 15 minut");
      }
      const username = await verifyCredentials(body.username, body.password);
      if (!username) {
        limiter.recordFailure(limitKey, Date.now());
        throw new HttpError(401, "Špatné jméno nebo heslo");
      }
      limiter.reset(limitKey);
      set.headers["set-cookie"] = await createLoginCookie(username);
      return { username };
    },
    { body: loginBody },
  )
  .post("/logout", ({ set }) => {
    set.headers["set-cookie"] = createLogoutCookie();
    return { ok: true };
  })
  .get("/me", async ({ request }): Promise<CurrentUser> => {
    const username = await authenticate(request);
    if (!username) {
      throw new HttpError(401, "Nepřihlášeno");
    }
    return { username };
  });

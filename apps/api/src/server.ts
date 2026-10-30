import { Elysia, ValidationError } from "elysia";
import { HttpError } from "./lib/errors.ts";
import { authRoutes } from "./modules/auth/routes.ts";
import { authenticate } from "./modules/auth/service.ts";
import { balanceRoutes } from "./modules/balances/routes.ts";
import { accountRoutes } from "./modules/catalog/accounts.ts";
import { counterpartyRoutes } from "./modules/catalog/counterparties.ts";
import { insuranceRoutes } from "./modules/catalog/insurance.ts";
import { settingsRoutes } from "./modules/catalog/settings.ts";
import { templateRoutes } from "./modules/catalog/templates.ts";
import { categoryRoutes } from "./modules/categories/routes.ts";
import { excelRoutes } from "./modules/excel/routes.ts";
import { itemRoutes } from "./modules/items/routes.ts";
import { monthRoutes } from "./modules/months/routes.ts";
import { overviewRoutes } from "./modules/overview/routes.ts";
import { serveWeb } from "./web/static.ts";

const PUBLIC_API_PATHS = new Set([
  "/api/health",
  "/api/auth/login",
  "/api/auth/logout",
]);

const SECURITY_HEADERS = {
  "content-security-policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
    "script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "x-frame-options": "DENY",
};

function errorBody(error: unknown, code: string | number) {
  if (error instanceof HttpError) {
    return { status: error.status, message: error.message };
  }
  if (error instanceof ValidationError) {
    const field = error.valueError?.path.replace(/^\//, "") || "vstup";
    return { status: 422, message: `Neplatná hodnota: ${field}` };
  }
  if (code === "NOT_FOUND") {
    return { status: 404, message: "Nenalezeno" };
  }
  if (code === "PARSE") {
    return { status: 400, message: "Neplatné tělo požadavku" };
  }
  console.error("Neočekávaná chyba serveru", error);
  return {
    status: 500,
    message: "Na serveru se něco pokazilo, zkus to prosím znovu",
  };
}

/** Všechna /api kromě přihlášení vyžadují session (deny by default). */
async function requireSession(request: Request) {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith("/api/") || PUBLIC_API_PATHS.has(pathname)) {
    return null;
  }
  return (await authenticate(request)) ? null : "Přihlas se prosím";
}

export const app = new Elysia()
  .onRequest(async ({ request, set }) => {
    Object.assign(set.headers, SECURITY_HEADERS);
    const denied = await requireSession(request);
    if (denied) {
      set.status = 401;
      return { error: denied };
    }
  })
  .onError(({ code, error, set }) => {
    const { status, message } = errorBody(error, code);
    set.status = status;
    return { error: message };
  })
  .get("/api/health", () => ({ ok: true }))
  .use(authRoutes)
  .use(settingsRoutes)
  .use(accountRoutes)
  .use(counterpartyRoutes)
  .use(templateRoutes)
  .use(insuranceRoutes)
  .use(itemRoutes)
  .use(categoryRoutes)
  .use(monthRoutes)
  .use(overviewRoutes)
  .use(balanceRoutes)
  .use(excelRoutes)
  .all("/api/*", () => {
    throw new HttpError(404, "Neznámá adresa API");
  })
  .get("/*", ({ request }) => serveWeb(new URL(request.url).pathname));

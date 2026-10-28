import { resolve } from "node:path";
import env from "env-var";

const NODE_ENV = env
  .get("NODE_ENV")
  .default("development")
  .asEnum(["production", "test", "development"]);

const isProduction = NODE_ENV === "production";

const DEV_DATABASE_URL = "postgresql://kkff:kkff-local@127.0.0.1:5433/kkff";

const DATABASE_URL = isProduction
  ? env.get("DATABASE_URL").required().asString()
  : env.get("DATABASE_URL").default(DEV_DATABASE_URL).asString();

export const config = {
  isProduction,
  port: env.get("PORT").default(3000).asPortNumber(),
  databaseUrl: DATABASE_URL,
  /** „jmeno:hash,jmeno:hash“ – hash z `bun run auth:hash-password` */
  authUsers: env.get("AUTH_USERS").default("").asString(),
  sessionSecret: env.get("AUTH_SESSION_SECRET").asString(),
  sessionMaxAgeDays: 30,
  webDistDir: env
    .get("WEB_DIST_DIR")
    .default(resolve(import.meta.dir, "../../web/dist"))
    .asString(),
  migrationsDir: env
    .get("MIGRATIONS_DIR")
    .default(resolve(import.meta.dir, "../drizzle"))
    .asString(),
  maxImportBytes: 10 * 1024 * 1024,
};

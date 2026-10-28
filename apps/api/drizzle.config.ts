import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://kkff:kkff-local@127.0.0.1:5433/kkff",
  },
} satisfies Config;

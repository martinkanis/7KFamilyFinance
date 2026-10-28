import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import type { Settings } from "../../contracts.ts";
import { db, type Executor } from "../../db/index.ts";
import { appSettings } from "../../db/schema.ts";
import { nullableDate } from "../../lib/schemas.ts";

const SETTINGS_ID = 1;

export async function loadSettings(executor: Executor = db): Promise<Settings> {
  const [row] = await executor
    .select({ startDate: appSettings.startDate })
    .from(appSettings)
    .where(eq(appSettings.id, SETTINGS_ID));
  return { startDate: row?.startDate ?? null };
}

export async function saveSettings(
  settings: Settings,
  executor: Executor = db,
): Promise<Settings> {
  await executor
    .insert(appSettings)
    .values({ id: SETTINGS_ID, ...settings })
    .onConflictDoUpdate({ target: appSettings.id, set: settings });
  return settings;
}

export const settingsRoutes = new Elysia({ prefix: "/api/settings" })
  .get("/", () => loadSettings())
  .put("/", ({ body }) => saveSettings(body), {
    body: t.Object({ startDate: nullableDate }),
  });

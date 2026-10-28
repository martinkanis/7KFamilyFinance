import { asc, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";
import type { Account } from "../../contracts.ts";
import { db, type Executor } from "../../db/index.ts";
import { accounts } from "../../db/schema.ts";
import { notFound, withDbErrors } from "../../lib/errors.ts";
import { firstOrThrow, normalizeTexts } from "../../lib/normalize.ts";
import {
  idParams,
  moneySchema,
  nullableText,
  requiredText,
} from "../../lib/schemas.ts";

const accountBody = t.Object({
  name: requiredText(),
  institution: nullableText(),
  owner: nullableText(),
  type: nullableText(),
  number: nullableText(64),
  currency: t.String({ pattern: "^[A-Z]{3}$" }),
  initialBalance: moneySchema,
  kind: t.Union([t.Literal("operating"), t.Literal("savings")]),
  note: nullableText(2000),
  sortOrder: t.Optional(t.Integer()),
});

const ENTITY = "Účet";

export async function nextSortOrder(executor: Executor = db): Promise<number> {
  const [row] = await executor
    .select({ max: sql<number>`coalesce(max(${accounts.sortOrder}), 0)` })
    .from(accounts);
  return Number(row?.max ?? 0) + 1;
}

export const accountRoutes = new Elysia({ prefix: "/api/accounts" })
  .get(
    "/",
    (): Promise<Account[]> =>
      db
        .select()
        .from(accounts)
        .orderBy(asc(accounts.sortOrder), asc(accounts.name)),
  )
  .post(
    "/",
    async ({ body }): Promise<Account> => {
      const values = normalizeTexts(body);
      const sortOrder = values.sortOrder ?? (await nextSortOrder());
      const rows = await withDbErrors(ENTITY, () =>
        db
          .insert(accounts)
          .values({ ...values, sortOrder })
          .returning(),
      );
      return firstOrThrow(rows, () => notFound(ENTITY));
    },
    { body: accountBody },
  )
  .put(
    "/:id",
    async ({ params, body }): Promise<Account> => {
      const rows = await withDbErrors(ENTITY, () =>
        db
          .update(accounts)
          .set(normalizeTexts(body))
          .where(eq(accounts.id, params.id))
          .returning(),
      );
      return firstOrThrow(rows, () => notFound(ENTITY));
    },
    { params: idParams, body: accountBody },
  )
  .delete(
    "/:id",
    async ({ params }) => {
      const rows = await db
        .delete(accounts)
        .where(eq(accounts.id, params.id))
        .returning({ id: accounts.id });
      return firstOrThrow(rows, () => notFound(ENTITY));
    },
    { params: idParams },
  );

import { asc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import type { Counterparty } from "../../contracts.ts";
import { db } from "../../db/index.ts";
import { counterparties } from "../../db/schema.ts";
import { notFound, withDbErrors } from "../../lib/errors.ts";
import { firstOrThrow, normalizeTexts } from "../../lib/normalize.ts";
import {
  idParams,
  nullableText,
  nullableUrl,
  requiredText,
} from "../../lib/schemas.ts";

const counterpartyBody = t.Object({
  name: requiredText(),
  type: nullableText(),
  accountNumber: nullableText(64),
  web: nullableUrl,
  contact: nullableText(),
  note: nullableText(2000),
});

const ENTITY = "Protistrana";

export const counterpartyRoutes = new Elysia({
  prefix: "/api/counterparties",
})
  .get(
    "/",
    (): Promise<Counterparty[]> =>
      db.select().from(counterparties).orderBy(asc(counterparties.name)),
  )
  .post(
    "/",
    async ({ body }): Promise<Counterparty> => {
      const rows = await withDbErrors(ENTITY, () =>
        db.insert(counterparties).values(normalizeTexts(body)).returning(),
      );
      return firstOrThrow(rows, () => notFound(ENTITY));
    },
    { body: counterpartyBody },
  )
  .put(
    "/:id",
    async ({ params, body }): Promise<Counterparty> => {
      const rows = await withDbErrors(ENTITY, () =>
        db
          .update(counterparties)
          .set(normalizeTexts(body))
          .where(eq(counterparties.id, params.id))
          .returning(),
      );
      return firstOrThrow(rows, () => notFound(ENTITY));
    },
    { params: idParams, body: counterpartyBody },
  )
  .delete(
    "/:id",
    async ({ params }) => {
      const rows = await db
        .delete(counterparties)
        .where(eq(counterparties.id, params.id))
        .returning({ id: counterparties.id });
      return firstOrThrow(rows, () => notFound(ENTITY));
    },
    { params: idParams },
  );

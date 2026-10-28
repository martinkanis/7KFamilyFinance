import { asc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import type { Template } from "../../contracts.ts";
import { db } from "../../db/index.ts";
import { templates } from "../../db/schema.ts";
import { notFound, withDbErrors } from "../../lib/errors.ts";
import { firstOrThrow, normalizeTexts } from "../../lib/normalize.ts";
import {
  idParams,
  nullableId,
  nullableMoney,
  nullableText,
  requiredText,
} from "../../lib/schemas.ts";

const templateBody = t.Object({
  code: requiredText(20),
  name: requiredText(),
  bankLogin: nullableText(),
  counterpartyId: nullableId,
  accountNumber: nullableText(64),
  vs: nullableText(10),
  ks: nullableText(10),
  ss: nullableText(10),
  message: nullableText(140),
  amount: nullableMoney,
  timesUsed: t.Union([t.Integer({ minimum: 0 }), t.Null()]),
  knownAccount: t.Boolean(),
  verified: t.Boolean(),
  note: nullableText(2000),
});

const ENTITY = "Šablona";

export const templateRoutes = new Elysia({ prefix: "/api/templates" })
  .get(
    "/",
    (): Promise<Template[]> =>
      db.select().from(templates).orderBy(asc(templates.code)),
  )
  .post(
    "/",
    async ({ body }): Promise<Template> => {
      const rows = await withDbErrors(ENTITY, () =>
        db.insert(templates).values(normalizeTexts(body)).returning(),
      );
      return firstOrThrow(rows, () => notFound(ENTITY));
    },
    { body: templateBody },
  )
  .put(
    "/:id",
    async ({ params, body }): Promise<Template> => {
      const rows = await withDbErrors(ENTITY, () =>
        db
          .update(templates)
          .set(normalizeTexts(body))
          .where(eq(templates.id, params.id))
          .returning(),
      );
      return firstOrThrow(rows, () => notFound(ENTITY));
    },
    { params: idParams, body: templateBody },
  )
  .delete(
    "/:id",
    async ({ params }) => {
      const rows = await db
        .delete(templates)
        .where(eq(templates.id, params.id))
        .returning({ id: templates.id });
      return firstOrThrow(rows, () => notFound(ENTITY));
    },
    { params: idParams },
  );

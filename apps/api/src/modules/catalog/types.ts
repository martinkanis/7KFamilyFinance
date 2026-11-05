import { asc, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";
import type { CategoryType } from "../../contracts.ts";
import { db } from "../../db/index.ts";
import { categoryTypes, paymentTypes } from "../../db/schema.ts";
import { notFound, withDbErrors } from "../../lib/errors.ts";
import { firstOrThrow, normalizeTexts } from "../../lib/normalize.ts";
import { idParams, requiredText } from "../../lib/schemas.ts";

const typeBody = t.Object({
  name: requiredText(),
  sortOrder: t.Optional(t.Integer()),
});

/** Číselník typů (nadkategorie, typy plateb): název a pořadí. */
function typeRoutes(
  prefix: string,
  table: typeof categoryTypes | typeof paymentTypes,
  entity: string,
) {
  const nextSortOrder = async () => {
    const [row] = await db
      .select({ max: sql<number>`coalesce(max(${table.sortOrder}), 0)` })
      .from(table);
    return Number(row?.max ?? 0) + 1;
  };
  return new Elysia({ prefix })
    .get(
      "/",
      (): Promise<CategoryType[]> =>
        db.select().from(table).orderBy(asc(table.sortOrder), asc(table.name)),
    )
    .post(
      "/",
      async ({ body }): Promise<CategoryType> => {
        const values = normalizeTexts(body);
        const sortOrder = values.sortOrder ?? (await nextSortOrder());
        const rows = await withDbErrors(entity, () =>
          db
            .insert(table)
            .values({ ...values, sortOrder })
            .returning(),
        );
        return firstOrThrow(rows, () => notFound(entity));
      },
      { body: typeBody },
    )
    .put(
      "/:id",
      async ({ params, body }): Promise<CategoryType> => {
        const rows = await withDbErrors(entity, () =>
          db
            .update(table)
            .set(normalizeTexts(body))
            .where(eq(table.id, params.id))
            .returning(),
        );
        return firstOrThrow(rows, () => notFound(entity));
      },
      { params: idParams, body: typeBody },
    )
    .delete(
      "/:id",
      async ({ params }) => {
        const rows = await db
          .delete(table)
          .where(eq(table.id, params.id))
          .returning({ id: table.id });
        return firstOrThrow(rows, () => notFound(entity));
      },
      { params: idParams },
    );
}

export const categoryTypeRoutes = typeRoutes(
  "/api/category-types",
  categoryTypes,
  "Nadkategorie",
);

export const paymentTypeRoutes = typeRoutes(
  "/api/payment-types",
  paymentTypes,
  "Typ platby",
);

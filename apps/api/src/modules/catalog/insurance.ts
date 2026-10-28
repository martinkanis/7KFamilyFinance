import { asc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import type { InsurancePolicy } from "../../contracts.ts";
import { db } from "../../db/index.ts";
import { insurancePolicies } from "../../db/schema.ts";
import { notFound, withDbErrors } from "../../lib/errors.ts";
import { firstOrThrow, normalizeTexts } from "../../lib/normalize.ts";
import {
  idParams,
  moneySchema,
  nullableText,
  requiredText,
} from "../../lib/schemas.ts";

const insuranceBody = t.Object({
  name: requiredText(),
  annualAmount: moneySchema,
  note: nullableText(2000),
});

const ENTITY = "Pojistka";

export const insuranceRoutes = new Elysia({ prefix: "/api/insurance" })
  .get(
    "/",
    (): Promise<InsurancePolicy[]> =>
      db.select().from(insurancePolicies).orderBy(asc(insurancePolicies.id)),
  )
  .post(
    "/",
    async ({ body }): Promise<InsurancePolicy> => {
      const rows = await withDbErrors(ENTITY, () =>
        db.insert(insurancePolicies).values(normalizeTexts(body)).returning(),
      );
      return firstOrThrow(rows, () => notFound(ENTITY));
    },
    { body: insuranceBody },
  )
  .put(
    "/:id",
    async ({ params, body }): Promise<InsurancePolicy> => {
      const rows = await withDbErrors(ENTITY, () =>
        db
          .update(insurancePolicies)
          .set(normalizeTexts(body))
          .where(eq(insurancePolicies.id, params.id))
          .returning(),
      );
      return firstOrThrow(rows, () => notFound(ENTITY));
    },
    { params: idParams, body: insuranceBody },
  )
  .delete(
    "/:id",
    async ({ params }) => {
      const rows = await db
        .delete(insurancePolicies)
        .where(eq(insurancePolicies.id, params.id))
        .returning({ id: insurancePolicies.id });
      return firstOrThrow(rows, () => notFound(ENTITY));
    },
    { params: idParams },
  );

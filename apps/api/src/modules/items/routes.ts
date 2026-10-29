import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { Elysia, type Static, t } from "elysia";
import type { CategoryRenameResult, Item } from "../../contracts.ts";
import { db } from "../../db/index.ts";
import { items, monthEntries } from "../../db/schema.ts";
import {
  InvalidDueMonthsError,
  parseDueMonths,
} from "../../domain/schedule.ts";
import { invalidInput, notFound, withDbErrors } from "../../lib/errors.ts";
import { firstOrThrow, normalizeTexts } from "../../lib/normalize.ts";
import {
  idParams,
  nullableDate,
  nullableDueDay,
  nullableId,
  nullableMoney,
  nullableText,
  requiredText,
} from "../../lib/schemas.ts";

const directionSchema = t.Union([t.Literal("expense"), t.Literal("income")]);

const itemBody = t.Object({
  code: requiredText(20),
  direction: directionSchema,
  category: requiredText(),
  name: requiredText(),
  amount: nullableMoney,
  amountFromInsurance: t.Boolean(),
  dueDay: nullableDueDay,
  dueMonths: nullableText(40),
  validFrom: nullableDate,
  validTo: nullableDate,
  ourAccountId: nullableId,
  counterpartyId: nullableId,
  templateId: nullableId,
  counterpartyAccount: nullableText(64),
  vs: nullableText(10),
  ks: nullableText(10),
  ss: nullableText(10),
  message: nullableText(140),
  savings: t.Boolean(),
  active: t.Boolean(),
  note: nullableText(2000),
  sortOrder: t.Optional(t.Integer()),
});

type ItemBody = Static<typeof itemBody>;

const itemRenameBody = t.Object({
  name: t.Optional(requiredText()),
  category: t.Optional(requiredText()),
});

const categoryRenameBody = t.Object({
  direction: directionSchema,
  from: requiredText(),
  to: requiredText(),
});

const ENTITY = "Položka";

function validateItem(input: ItemBody): ItemBody {
  const item = normalizeTexts(input);
  try {
    parseDueMonths(item.dueMonths);
  } catch (error) {
    if (error instanceof InvalidDueMonthsError) {
      throw invalidInput(error.message);
    }
    throw error;
  }
  if (item.validFrom && item.validTo && item.validFrom > item.validTo) {
    throw invalidInput("„Platí od“ musí být před „Platí do“");
  }
  return item.amountFromInsurance ? { ...item, amount: null } : item;
}

/** Kategorie je jen text u položek a jednorázových plateb – přejmenuje se všude naráz. */
function renameCategory({
  direction,
  from,
  to,
}: Static<typeof categoryRenameBody>): Promise<CategoryRenameResult> {
  const [source, target] = [from.trim(), to.trim()];
  return db.transaction(async (tx) => {
    const renamedItems = await tx
      .update(items)
      .set({ category: target })
      .where(and(eq(items.direction, direction), eq(items.category, source)))
      .returning({ id: items.id });
    const renamedOneOffs = await tx
      .update(monthEntries)
      .set({ category: target })
      .where(
        and(
          isNull(monthEntries.itemId),
          eq(monthEntries.direction, direction),
          eq(monthEntries.category, source),
        ),
      )
      .returning({ id: monthEntries.id });
    return { items: renamedItems.length, oneOffs: renamedOneOffs.length };
  });
}

async function nextSortOrder(): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${items.sortOrder}), 0)` })
    .from(items);
  return Number(row?.max ?? 0) + 1;
}

export const itemRoutes = new Elysia({ prefix: "/api/items" })
  .get(
    "/",
    (): Promise<Item[]> =>
      db.select().from(items).orderBy(asc(items.sortOrder), asc(items.code)),
  )
  .post(
    "/",
    async ({ body }): Promise<Item> => {
      const item = validateItem(body);
      const sortOrder = item.sortOrder ?? (await nextSortOrder());
      const rows = await withDbErrors(ENTITY, () =>
        db
          .insert(items)
          .values({ ...item, sortOrder })
          .returning(),
      );
      return firstOrThrow(rows, () => notFound(ENTITY));
    },
    { body: itemBody },
  )
  .put(
    "/:id",
    async ({ params, body }): Promise<Item> => {
      const item = validateItem(body);
      const rows = await withDbErrors(ENTITY, () =>
        db.update(items).set(item).where(eq(items.id, params.id)).returning(),
      );
      return firstOrThrow(rows, () => notFound(ENTITY));
    },
    { params: idParams, body: itemBody },
  )
  .patch(
    "/:id",
    async ({ params, body }): Promise<Item> => {
      const rename = normalizeTexts(body);
      if (rename.name == null && rename.category == null) {
        throw invalidInput("Vyplň nový název nebo kategorii");
      }
      const rows = await withDbErrors(ENTITY, () =>
        db.update(items).set(rename).where(eq(items.id, params.id)).returning(),
      );
      return firstOrThrow(rows, () => notFound(ENTITY));
    },
    { params: idParams, body: itemRenameBody },
  )
  .post(
    "/rename-category",
    ({ body }): Promise<CategoryRenameResult> => renameCategory(body),
    { body: categoryRenameBody },
  )
  .delete(
    "/:id",
    async ({ params }) => {
      const rows = await db
        .delete(items)
        .where(eq(items.id, params.id))
        .returning({ id: items.id });
      return firstOrThrow(rows, () => notFound(ENTITY));
    },
    { params: idParams },
  );

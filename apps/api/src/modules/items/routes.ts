import { and, eq, isNull, sql } from "drizzle-orm";
import { Elysia, type Static, t } from "elysia";
import type {
  CategoryRenameResult,
  ChangeableField,
  Item,
  ItemWithChanges,
} from "../../contracts.ts";
import { db } from "../../db/index.ts";
import { itemChanges, items, monthEntries } from "../../db/schema.ts";
import {
  CHANGEABLE_FIELDS,
  changedValues,
  itemAsOf,
} from "../../domain/itemChanges.ts";
import { monthKeyOfDate } from "../../domain/month.ts";
import {
  InvalidDueMonthsError,
  parseDueMonths,
} from "../../domain/schedule.ts";
import { invalidInput, notFound, withDbErrors } from "../../lib/errors.ts";
import { firstOrThrow, normalizeTexts } from "../../lib/normalize.ts";
import {
  idParams,
  monthKeySchema,
  nullableDate,
  nullableDueDay,
  nullableId,
  nullableMoney,
  nullableText,
  requiredText,
} from "../../lib/schemas.ts";
import { todayInPrague } from "../../lib/today.ts";
import {
  deleteItemChange,
  loadItemsWithChanges,
  upsertItemChange,
} from "./changes.ts";

const directionSchema = t.Union([t.Literal("expense"), t.Literal("income")]);
const ALL_MONTHS = "all";

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
  /** Od kdy platí změna částky, splatnosti, účtů a VS; „all“ = ve všech měsících. */
  effectiveFrom: t.Optional(
    t.Union([monthKeySchema, t.Literal(ALL_MONTHS), t.Null()]),
  ),
});

type ItemBody = Static<typeof itemBody>;
type ItemValues = Omit<ItemBody, "effectiveFrom">;

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

function validateItem({ effectiveFrom, ...input }: ItemBody): ItemValues {
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

const FIELD_LABELS: Record<ChangeableField, string> = {
  amount: "částku",
  dueDay: "den splatnosti",
  ourAccountId: "náš účet",
  counterpartyAccount: "účet protistrany",
  vs: "VS",
};

const currentMonth = () => monthKeyOfDate(todayInPrague());

/**
 * Úprava položky. Částka, splatnost, účty a VS se uloží jako změna od měsíce
 * `effectiveFrom` dál, takže minulé měsíce zůstanou; „all“ je přepíše ve všech
 * měsících a změny od měsíce smaže. Ostatní údaje platí vždy všude.
 */
async function updateItem(id: number, body: ItemBody): Promise<void> {
  const item = validateItem(body);
  const { effectiveFrom } = body;
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(items).where(eq(items.id, id));
    if (!existing) throw notFound(ENTITY);
    if (effectiveFrom == null || effectiveFrom === ALL_MONTHS) {
      await withDbErrors(ENTITY, () =>
        tx.update(items).set(item).where(eq(items.id, id)),
      );
      await tx.delete(itemChanges).where(eq(itemChanges.itemId, id));
      return;
    }
    const changes = await tx
      .select()
      .from(itemChanges)
      .where(eq(itemChanges.itemId, id));
    const changed = changedValues(
      itemAsOf(existing, changes, effectiveFrom),
      item,
    );
    if (item.amountFromInsurance) delete changed.amount;
    const cleared = CHANGEABLE_FIELDS.filter(
      (field) => field in changed && changed[field] == null,
    );
    if (cleared.length > 0) {
      throw invalidInput(
        `Vymazat ${cleared.map((f) => FIELD_LABELS[f]).join(", ")} jde jen ve všech měsících – v „Změny platí“ zvol „ve všech měsících“.`,
      );
    }
    const base = { ...item };
    for (const field of CHANGEABLE_FIELDS) {
      Object.assign(base, { [field]: existing[field] });
    }
    await withDbErrors(ENTITY, () =>
      tx.update(items).set(base).where(eq(items.id, id)),
    );
    await upsertItemChange(tx, id, effectiveFrom, changed);
  });
}

async function itemWithChanges(id: number): Promise<ItemWithChanges> {
  const found = (await loadItemsWithChanges(currentMonth())).find(
    (item) => item.id === id,
  );
  if (!found) throw notFound(ENTITY);
  return found;
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
    (): Promise<ItemWithChanges[]> => loadItemsWithChanges(currentMonth()),
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
    async ({ params, body }): Promise<ItemWithChanges> => {
      await updateItem(params.id, body);
      return itemWithChanges(params.id);
    },
    { params: idParams, body: itemBody },
  )
  .delete(
    "/:id/changes/:changeId",
    async ({ params }): Promise<ItemWithChanges> => {
      await deleteItemChange(params.id, params.changeId);
      return itemWithChanges(params.id);
    },
    {
      params: t.Object({
        id: t.Numeric({ minimum: 1 }),
        changeId: t.Numeric({ minimum: 1 }),
      }),
    },
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

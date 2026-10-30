import { and, eq, gte, isNull, sql } from "drizzle-orm";
import type {
  EntryInput,
  ItemEntryInput,
  MonthCorrection,
  MonthView,
  OneOffInput,
} from "../../contracts.ts";
import { db } from "../../db/index.ts";
import { items, monthEntries, monthSettings } from "../../db/schema.ts";
import type { ChangeValues } from "../../domain/itemChanges.ts";
import { firstDayOf } from "../../domain/month.ts";
import {
  breakdownByAccount,
  buildMonthRows,
  indexCatalog,
  monthCategories,
  summarizeMonth,
} from "../../domain/planner.ts";
import { endingFrom, nextItemCode } from "../../domain/schedule.ts";
import { notFound, withDbErrors } from "../../lib/errors.ts";
import { firstOrThrow, normalizeTexts } from "../../lib/normalize.ts";
import { todayInPrague } from "../../lib/today.ts";
import { upsertItemChange } from "../items/changes.ts";
import {
  loadCorrection,
  loadEntriesOfMonth,
  loadPlannerCatalog,
} from "../planning/catalog.ts";

const ENTRY = "Platba";
const ONE_OFF = "Jednorázová platba";
const ITEM = "Položka";

export async function getMonthView(month: string): Promise<MonthView> {
  const [catalog, entries, correction] = await Promise.all([
    loadPlannerCatalog(),
    loadEntriesOfMonth(month),
    loadCorrection(month),
  ]);
  const index = indexCatalog(catalog);
  const rows = buildMonthRows(month, index, entries);
  return {
    month,
    rows,
    categories: monthCategories(index, rows),
    summary: summarizeMonth(rows),
    accounts: breakdownByAccount(rows, catalog.accounts),
    correction,
  };
}

/** Datum úhrady dává smysl jen u zaplacené platby; když chybí, doplní se dnešek. */
function entryValues<T extends EntryInput>(input: T): T {
  const values = normalizeTexts(input);
  const paidOn =
    values.status === "paid" ? (values.paidOn ?? todayInPrague()) : null;
  return { ...values, paidOn };
}

function isDefaultEntry(entry: EntryInput): boolean {
  return (
    entry.status === "unpaid" &&
    entry.note == null &&
    entry.amount == null &&
    entry.dueDay == null &&
    entry.ourAccountId == null &&
    entry.counterpartyAccount == null &&
    entry.vs == null
  );
}

/**
 * Uloží stav a přepsání položky v měsíci; výchozí stav se neukládá.
 * Hodnoty v `promote` se místo přepsání uloží jako změna položky od tohoto
 * měsíce dál (ruční úpravy pozdějších měsíců zůstanou).
 */
export async function saveItemEntry(
  month: string,
  itemId: number,
  { promote = [], ...input }: ItemEntryInput,
): Promise<void> {
  const values = entryValues(input);
  const change: ChangeValues = {};
  for (const field of promote) {
    if (values[field] != null) {
      Object.assign(change, { [field]: values[field] });
      Object.assign(values, { [field]: null });
    }
  }
  const sameEntry = and(
    eq(monthEntries.month, month),
    eq(monthEntries.itemId, itemId),
  );
  await db.transaction(async (tx) => {
    await upsertItemChange(tx, itemId, month, change);
    if (isDefaultEntry(values)) {
      await tx.delete(monthEntries).where(sameEntry);
      return;
    }
    await withDbErrors(ENTRY, () =>
      tx
        .insert(monthEntries)
        .values({ month, itemId, ...values })
        .onConflictDoUpdate({
          target: [monthEntries.month, monthEntries.itemId],
          set: values,
        }),
    );
  });
}

export async function createOneOff(
  month: string,
  input: OneOffInput,
): Promise<void> {
  await withDbErrors(ONE_OFF, () =>
    db.insert(monthEntries).values({ month, ...entryValues(input) }),
  );
}

function oneOffOf(month: string, id: number) {
  return and(
    eq(monthEntries.id, id),
    eq(monthEntries.month, month),
    isNull(monthEntries.itemId),
  );
}

export async function updateOneOff(
  month: string,
  id: number,
  input: OneOffInput,
): Promise<void> {
  const rows = await withDbErrors(ONE_OFF, () =>
    db
      .update(monthEntries)
      .set(entryValues(input))
      .where(oneOffOf(month, id))
      .returning({ id: monthEntries.id }),
  );
  firstOrThrow(rows, () => notFound(ONE_OFF));
}

export async function deleteOneOff(month: string, id: number): Promise<void> {
  const rows = await db
    .delete(monthEntries)
    .where(oneOffOf(month, id))
    .returning({ id: monthEntries.id });
  firstOrThrow(rows, () => notFound(ONE_OFF));
}

/**
 * Nová pravidelná platba přímo z měsíce: položka platná od tohoto měsíce
 * s dalším volným ID, na konci své kategorie. Stav a poznámka patří měsíci.
 */
export async function createRecurringItem(
  month: string,
  input: OneOffInput,
): Promise<void> {
  const values = entryValues(input);
  await db.transaction(async (tx) => {
    const codes = await tx.select({ code: items.code }).from(items);
    const [max] = await tx
      .select({ value: sql<number>`coalesce(max(${items.sortOrder}), 0)` })
      .from(items);
    const rows = await withDbErrors(ITEM, () =>
      tx
        .insert(items)
        .values({
          code: nextItemCode(
            values.direction,
            codes.map((row) => row.code),
          ),
          direction: values.direction,
          category: values.category,
          name: values.name,
          amount: values.amount,
          dueDay: values.dueDay,
          validFrom: firstDayOf(month),
          ourAccountId: values.ourAccountId,
          counterpartyId: values.counterpartyId,
          counterpartyAccount: values.counterpartyAccount,
          vs: values.vs,
          sortOrder: Number(max?.value ?? 0) + 1,
        })
        .returning({ id: items.id }),
    );
    const item = firstOrThrow(rows, () => notFound(ITEM));
    if (values.status !== "unpaid" || values.note != null) {
      await tx.insert(monthEntries).values({
        month,
        itemId: item.id,
        status: values.status,
        paidOn: values.paidOn,
        note: values.note,
      });
    }
  });
}

/** Pravidelná položka od tohoto měsíce končí; záznamy od měsíce dál se smažou. */
export async function endItemFrom(
  month: string,
  itemId: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [item] = await tx
      .select({ validFrom: items.validFrom, validTo: items.validTo })
      .from(items)
      .where(eq(items.id, itemId));
    if (!item) throw notFound(ITEM);
    const ending = endingFrom(item, month);
    if (ending.kind === "delete") {
      await tx.delete(items).where(eq(items.id, itemId));
      return;
    }
    await tx
      .update(items)
      .set({ validTo: ending.validTo })
      .where(eq(items.id, itemId));
    await tx
      .delete(monthEntries)
      .where(
        and(eq(monthEntries.itemId, itemId), gte(monthEntries.month, month)),
      );
  });
}

export async function saveCorrection(
  month: string,
  input: MonthCorrection,
): Promise<void> {
  const { amount, note } = normalizeTexts(input);
  if (amount === 0 && note == null) {
    await db.delete(monthSettings).where(eq(monthSettings.month, month));
    return;
  }
  const values = { wealthCorrection: amount, note };
  await db
    .insert(monthSettings)
    .values({ month, ...values })
    .onConflictDoUpdate({ target: monthSettings.month, set: values });
}

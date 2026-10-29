import { and, asc, eq } from "drizzle-orm";
import type { ItemWithChanges } from "../../contracts.ts";
import { db, type Executor } from "../../db/index.ts";
import { itemChanges, items } from "../../db/schema.ts";
import { type ChangeValues, itemAsOf } from "../../domain/itemChanges.ts";
import { notFound, withDbErrors } from "../../lib/errors.ts";
import { firstOrThrow } from "../../lib/normalize.ts";

const CHANGE = "Změna položky";

/** Změna od měsíce; existující změnu ve stejném měsíci doplní. */
export async function upsertItemChange(
  executor: Executor,
  itemId: number,
  fromMonth: string,
  values: ChangeValues,
): Promise<void> {
  if (Object.keys(values).length === 0) return;
  await withDbErrors(CHANGE, () =>
    executor
      .insert(itemChanges)
      .values({ itemId, fromMonth, ...values })
      .onConflictDoUpdate({
        target: [itemChanges.itemId, itemChanges.fromMonth],
        set: values,
      }),
  );
}

/** Položky s hodnotami platnými v měsíci a s jejich změnami. */
export async function loadItemsWithChanges(
  month: string,
  executor: Executor = db,
): Promise<ItemWithChanges[]> {
  const [itemRows, changeRows] = await Promise.all([
    executor
      .select()
      .from(items)
      .orderBy(asc(items.sortOrder), asc(items.code)),
    executor.select().from(itemChanges).orderBy(asc(itemChanges.fromMonth)),
  ]);
  return itemRows.map((item) => {
    const changes = changeRows.filter((change) => change.itemId === item.id);
    return {
      ...itemAsOf(item, changes, month),
      effectiveFrom: month,
      changes,
    };
  });
}

export async function deleteItemChange(
  itemId: number,
  changeId: number,
): Promise<void> {
  const rows = await db
    .delete(itemChanges)
    .where(and(eq(itemChanges.id, changeId), eq(itemChanges.itemId, itemId)))
    .returning({ id: itemChanges.id });
  firstOrThrow(rows, () => notFound(CHANGE));
}

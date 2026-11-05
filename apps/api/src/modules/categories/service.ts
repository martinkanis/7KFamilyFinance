import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type {
  CategoryDelete,
  CategoryRef,
  CategoryTree,
  Direction,
  RowOrder,
} from "../../contracts.ts";
import { db, type Executor } from "../../db/index.ts";
import { categories, items, monthEntries } from "../../db/schema.ts";
import { type TreeNode, treeOrder } from "../../domain/categoryTree.ts";
import { invalidInput } from "../../lib/errors.ts";

const DIRECTIONS: Direction[] = ["expense", "income"];

/** Kategorie, které používají položky nebo jednorázové platby (v pořadí položek). */
async function usedCategories(
  executor: Executor,
  direction: Direction,
): Promise<string[]> {
  const [fromItems, fromOneOffs] = await Promise.all([
    executor
      .select({ name: items.category })
      .from(items)
      .where(eq(items.direction, direction))
      .groupBy(items.category)
      .orderBy(sql`min(${items.sortOrder})`),
    executor
      .selectDistinct({ name: monthEntries.category })
      .from(monthEntries)
      .where(
        and(isNull(monthEntries.itemId), eq(monthEntries.direction, direction)),
      )
      .orderBy(asc(monthEntries.category)),
  ]);
  const names = [...fromItems, ...fromOneOffs]
    .map((row) => row.name)
    .filter((name): name is string => name != null);
  return [...new Set(names)];
}

/**
 * Strom kategorií směru v zobrazeném pořadí: uložené (i prázdné, s nadřazenými),
 * pak ostatní používané na nejvyšší úrovni.
 */
async function knownTree(
  executor: Executor,
  direction: Direction,
): Promise<TreeNode[]> {
  const stored = await executor
    .select({ name: categories.name, parent: categories.parent })
    .from(categories)
    .where(eq(categories.direction, direction))
    .orderBy(asc(categories.sortOrder));
  const used = await usedCategories(executor, direction);
  return treeOrder([
    ...stored,
    ...used.map((name) => ({ name, parent: null })),
  ]).map(({ name, parent }) => ({ name, parent }));
}

/**
 * Uloží strom kategorií směru v pořadí `nodes`; používané kategorie, které
 * v něm chybí, přijdou na konec (žádná platba tak nezmizí z pohledu).
 */
async function saveCategoryTree(
  executor: Executor,
  direction: Direction,
  nodes: TreeNode[],
): Promise<string[]> {
  const used = await usedCategories(executor, direction);
  const ordered = treeOrder([
    ...nodes,
    ...used.map((name) => ({ name, parent: null })),
  ]);
  await executor.delete(categories).where(eq(categories.direction, direction));
  if (ordered.length > 0) {
    await executor.insert(categories).values(
      ordered.map((node, index) => ({
        direction,
        name: node.name,
        parent: node.parent,
        sortOrder: index + 1,
      })),
    );
  }
  return ordered.map((node) => node.name);
}

/** Nové pořadí a vnoření kategorií po přetažení. */
export function saveTree({ direction, nodes }: CategoryTree): Promise<void> {
  return db.transaction(async (tx) => {
    await saveCategoryTree(tx, direction, nodes);
  });
}

export function addCategory({ direction, name }: CategoryRef): Promise<void> {
  return db.transaction(async (tx) => {
    const known = await knownTree(tx, direction);
    if (known.some((node) => node.name === name)) {
      throw invalidInput(`Kategorie „${name}“ už existuje`);
    }
    await saveCategoryTree(tx, direction, [...known, { name, parent: null }]);
  });
}

/**
 * Smaže kategorii; platby z ní (ve všech měsících) přesune do `moveTo`.
 * Její podkategorie se posunou o úroveň výš.
 */
export function deleteCategory({
  direction,
  name,
  moveTo,
}: CategoryDelete): Promise<void> {
  return db.transaction(async (tx) => {
    const inItems = and(
      eq(items.direction, direction),
      eq(items.category, name),
    );
    const inOneOffs = and(
      isNull(monthEntries.itemId),
      eq(monthEntries.direction, direction),
      eq(monthEntries.category, name),
    );
    const [itemRows, oneOffRows] = await Promise.all([
      tx.select({ id: items.id }).from(items).where(inItems),
      tx.select({ id: monthEntries.id }).from(monthEntries).where(inOneOffs),
    ]);
    const known = await knownTree(tx, direction);
    if (itemRows.length + oneOffRows.length > 0) {
      if (moveTo == null || moveTo === name) {
        throw invalidInput(
          `Kategorie „${name}“ obsahuje platby – vyber, kam je přesunout`,
        );
      }
      await tx.update(items).set({ category: moveTo }).where(inItems);
      await tx.update(monthEntries).set({ category: moveTo }).where(inOneOffs);
    }
    const parentOfDeleted =
      known.find((node) => node.name === name)?.parent ?? null;
    await saveCategoryTree(
      tx,
      direction,
      known
        .filter((node) => node.name !== name)
        .map((node) =>
          node.parent === name ? { ...node, parent: parentOfDeleted } : node,
        ),
    );
  });
}

/**
 * Přejmenování kategorie ve stromu: nese si nadřazenou i podkategorie
 * (stejný název už existuje → kategorie se sloučí).
 */
export async function renameStoredCategory(
  executor: Executor,
  direction: Direction,
  from: string,
  to: string,
): Promise<void> {
  const known = await knownTree(executor, direction);
  await saveCategoryTree(
    executor,
    direction,
    known.map((node) => ({
      name: node.name === from ? to : node.name,
      parent: node.parent === from ? to : node.parent,
    })),
  );
}

/**
 * Nové pořadí plateb v kategorii po přetažení. Přesunuté platby změní
 * kategorii (pravidelné ve všech měsících, jednorázové jen v tomto měsíci).
 * Položky se přečíslují, aby pořadí v Položkách odpovídalo měsíci;
 * jednorázová platba si pamatuje, za kterou položkou stojí.
 */
export function reorderRows(month: string, order: RowOrder): Promise<void> {
  const { direction, name, rows } = order;
  return db.transaction(async (tx) => {
    const itemIds = rows.filter((r) => r.kind === "item").map((r) => r.id);
    if (itemIds.length > 0) {
      await tx
        .update(items)
        .set({ category: name, direction })
        .where(and(inArray(items.id, itemIds), eq(items.direction, direction)));
    }
    let afterItemId: number | null = null;
    for (const [position, row] of rows.entries()) {
      if (row.kind === "item") {
        afterItemId = row.id;
        continue;
      }
      await tx
        .update(monthEntries)
        .set({ category: name, afterItemId, sortOrder: position })
        .where(
          and(
            eq(monthEntries.id, row.id),
            eq(monthEntries.month, month),
            isNull(monthEntries.itemId),
          ),
        );
    }
    await renumberItems(tx, direction, name, itemIds);
  });
}

async function renumberItems(
  executor: Executor,
  direction: Direction,
  category: string,
  orderedIds: number[],
): Promise<void> {
  const ranks = new Map<string, number>();
  for (const dir of DIRECTIONS) {
    const names = await saveCategoryTree(
      executor,
      dir,
      await knownTree(executor, dir),
    );
    for (const [index, name] of names.entries()) {
      ranks.set(`${dir}|${name}`, index);
    }
  }
  const all = await executor
    .select({
      id: items.id,
      direction: items.direction,
      category: items.category,
      sortOrder: items.sortOrder,
    })
    .from(items)
    .orderBy(asc(items.sortOrder), asc(items.code));
  const position = new Map(orderedIds.map((id, index) => [id, index]));
  const withinCategory = (item: (typeof all)[number], index: number) =>
    item.direction === direction && item.category === category
      ? (position.get(item.id) ?? orderedIds.length + index)
      : index;
  const sorted = all
    .map((item, index) => ({ item, within: withinCategory(item, index) }))
    .sort(
      (a, b) =>
        DIRECTIONS.indexOf(a.item.direction) -
          DIRECTIONS.indexOf(b.item.direction) ||
        (ranks.get(`${a.item.direction}|${a.item.category}`) ?? 0) -
          (ranks.get(`${b.item.direction}|${b.item.category}`) ?? 0) ||
        a.within - b.within,
    );
  for (const [index, { item }] of sorted.entries()) {
    if (item.sortOrder !== index + 1) {
      await executor
        .update(items)
        .set({ sortOrder: index + 1 })
        .where(eq(items.id, item.id));
    }
  }
}

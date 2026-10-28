import type { ImportResult } from "../../contracts.ts";
import { db, type Transaction } from "../../db/index.ts";
import {
  accounts,
  counterparties,
  insurancePolicies,
  items,
  monthEntries,
  monthSettings,
  templates,
} from "../../db/schema.ts";
import { saveSettings } from "../catalog/settings.ts";
import type { ImportData, ImportedEntry } from "./parseWorkbook.ts";

type IdMap = Map<string, number>;

class ReferenceResolver {
  constructor(private readonly warnings: string[]) {}

  resolve(ids: IdMap, name: string | null, context: string): number | null {
    if (name == null) {
      return null;
    }
    const id = ids.get(name);
    if (id === undefined) {
      this.warnings.push(`${context}: „${name}“ neexistuje, nechávám prázdné`);
      return null;
    }
    return id;
  }
}

async function insertNamed<T extends { name: string }>(
  rows: T[],
  insert: (rows: T[]) => Promise<{ id: number; name: string }[]>,
): Promise<IdMap> {
  if (rows.length === 0) {
    return new Map();
  }
  const inserted = await insert(rows);
  return new Map(inserted.map((row) => [row.name, row.id]));
}

async function deleteAll(tx: Transaction): Promise<void> {
  await tx.delete(monthEntries);
  await tx.delete(monthSettings);
  await tx.delete(items);
  await tx.delete(templates);
  await tx.delete(insurancePolicies);
  await tx.delete(counterparties);
  await tx.delete(accounts);
}

async function insertTemplates(
  tx: Transaction,
  data: ImportData,
  counterpartyIds: IdMap,
  refs: ReferenceResolver,
): Promise<IdMap> {
  const rows = data.templates.map(({ counterpartyName, ...template }) => ({
    ...template,
    counterpartyId: refs.resolve(
      counterpartyIds,
      counterpartyName,
      `Šablona ${template.code}, protistrana`,
    ),
  }));
  if (rows.length === 0) {
    return new Map();
  }
  const inserted = await tx
    .insert(templates)
    .values(rows)
    .returning({ id: templates.id, code: templates.code });
  return new Map(inserted.map((row) => [row.code, row.id]));
}

async function insertItems(
  tx: Transaction,
  data: ImportData,
  ids: { accounts: IdMap; counterparties: IdMap; templates: IdMap },
  refs: ReferenceResolver,
): Promise<IdMap> {
  const rows = data.items.map(
    ({ ourAccountName, counterpartyName, templateCode, ...item }) => ({
      ...item,
      ourAccountId: refs.resolve(
        ids.accounts,
        ourAccountName,
        `Položka ${item.code}, náš účet`,
      ),
      counterpartyId: refs.resolve(
        ids.counterparties,
        counterpartyName,
        `Položka ${item.code}, protistrana`,
      ),
      templateId: refs.resolve(
        ids.templates,
        templateCode,
        `Položka ${item.code}, šablona`,
      ),
    }),
  );
  if (rows.length === 0) {
    return new Map();
  }
  const inserted = await tx
    .insert(items)
    .values(rows)
    .returning({ id: items.id, code: items.code });
  return new Map(inserted.map((row) => [row.code, row.id]));
}

function validDueDay(day: number | null): number | null {
  return day != null && Number.isInteger(day) && day >= 1 && day <= 31
    ? day
    : null;
}

interface EntryIds {
  items: IdMap;
  accounts: IdMap;
  counterparties: IdMap;
}

function entryRow(
  entry: ImportedEntry,
  ids: EntryIds,
  refs: ReferenceResolver,
) {
  const context = `Měsíc ${entry.month}`;
  const itemId =
    entry.itemCode == null
      ? null
      : refs.resolve(ids.items, entry.itemCode, `${context}, položka`);
  if (entry.itemCode != null && itemId == null) {
    return null;
  }
  const {
    itemCode: _itemCode,
    ourAccountName,
    counterpartyName,
    ...values
  } = entry;
  return {
    ...values,
    itemId,
    dueDay: validDueDay(entry.dueDay),
    ourAccountId: refs.resolve(
      ids.accounts,
      ourAccountName,
      `${context}, náš účet`,
    ),
    counterpartyId: refs.resolve(
      ids.counterparties,
      counterpartyName,
      `${context}, protistrana`,
    ),
  };
}

async function insertEntries(
  tx: Transaction,
  data: ImportData,
  ids: EntryIds,
  refs: ReferenceResolver,
): Promise<number> {
  const seenItemMonths = new Set<string>();
  const isFirstForItemMonth = (row: {
    month: string;
    itemId: number | null;
  }) => {
    if (row.itemId == null) {
      return true;
    }
    const key = `${row.month}|${row.itemId}`;
    const isFirst = !seenItemMonths.has(key);
    seenItemMonths.add(key);
    return isFirst;
  };
  const rows = data.entries
    .map((entry) => entryRow(entry, ids, refs))
    .filter((row) => row !== null)
    .filter(isFirstForItemMonth);
  if (rows.length > 0) {
    await tx.insert(monthEntries).values(rows);
  }
  return rows.length;
}

/** Nahradí všechna data obsahem sešitu; buď celé, nebo vůbec (transakce). */
export function replaceAllData(data: ImportData): Promise<ImportResult> {
  const warnings = [...data.warnings];
  const refs = new ReferenceResolver(warnings);
  return db.transaction(async (tx) => {
    await deleteAll(tx);
    await saveSettings({ startDate: data.startDate }, tx);
    const accountIds = await insertNamed(data.accounts, (rows) =>
      tx
        .insert(accounts)
        .values(rows)
        .returning({ id: accounts.id, name: accounts.name }),
    );
    const counterpartyIds = await insertNamed(data.counterparties, (rows) =>
      tx
        .insert(counterparties)
        .values(rows)
        .returning({ id: counterparties.id, name: counterparties.name }),
    );
    const templateIds = await insertTemplates(tx, data, counterpartyIds, refs);
    if (data.insurance.length > 0) {
      await tx.insert(insurancePolicies).values(data.insurance);
    }
    const itemIds = await insertItems(
      tx,
      data,
      {
        accounts: accountIds,
        counterparties: counterpartyIds,
        templates: templateIds,
      },
      refs,
    );
    const entryCount = await insertEntries(
      tx,
      data,
      { items: itemIds, accounts: accountIds, counterparties: counterpartyIds },
      refs,
    );
    if (data.corrections.length > 0) {
      await tx.insert(monthSettings).values(
        data.corrections.map((correction) => ({
          month: correction.month,
          wealthCorrection: correction.amount,
        })),
      );
    }
    return {
      counts: {
        účty: accountIds.size,
        protistrany: counterpartyIds.size,
        šablony: templateIds.size,
        pojistky: data.insurance.length,
        položky: itemIds.size,
        "záznamy v měsících": entryCount,
        "korekce majetku": data.corrections.length,
      },
      warnings,
    };
  });
}

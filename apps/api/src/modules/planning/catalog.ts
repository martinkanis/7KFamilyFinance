import { asc, eq } from "drizzle-orm";
import type { MonthCorrection } from "../../contracts.ts";
import { db, type Executor } from "../../db/index.ts";
import {
  accounts,
  categories,
  counterparties,
  insurancePolicies,
  itemChanges,
  items,
  monthEntries,
  monthSettings,
  templates,
} from "../../db/schema.ts";
import {
  insuranceReserveOf,
  type MonthEntryRecord,
  type PlannerCatalog,
} from "../../domain/planner.ts";

/** Vše, co plánovač potřebuje kromě záznamů jednotlivých měsíců. */
export async function loadPlannerCatalog(
  executor: Executor = db,
): Promise<PlannerCatalog> {
  const [
    itemRows,
    templateRows,
    counterpartyRows,
    accountRows,
    policies,
    changeRows,
    categoryRows,
  ] = await Promise.all([
    executor.select().from(items).orderBy(asc(items.sortOrder)),
    executor.select().from(templates).orderBy(asc(templates.code)),
    executor.select().from(counterparties).orderBy(asc(counterparties.name)),
    executor.select().from(accounts).orderBy(asc(accounts.sortOrder)),
    executor
      .select()
      .from(insurancePolicies)
      .orderBy(asc(insurancePolicies.id)),
    executor.select().from(itemChanges),
    executor.select().from(categories).orderBy(asc(categories.sortOrder)),
  ]);
  return {
    items: itemRows,
    templates: templateRows,
    counterparties: counterpartyRows,
    accounts: accountRows,
    itemChanges: changeRows,
    categories: categoryRows,
    insuranceReserve: insuranceReserveOf(
      policies.map((policy) => policy.annualAmount),
    ),
  };
}

export function loadEntriesOfMonth(
  month: string,
  executor: Executor = db,
): Promise<MonthEntryRecord[]> {
  return executor
    .select()
    .from(monthEntries)
    .where(eq(monthEntries.month, month))
    .orderBy(asc(monthEntries.id));
}

export function loadAllEntries(
  executor: Executor = db,
): Promise<MonthEntryRecord[]> {
  return executor.select().from(monthEntries).orderBy(asc(monthEntries.id));
}

export async function loadCorrection(
  month: string,
  executor: Executor = db,
): Promise<MonthCorrection> {
  const [row] = await executor
    .select()
    .from(monthSettings)
    .where(eq(monthSettings.month, month));
  return { amount: row?.wealthCorrection ?? 0, note: row?.note ?? null };
}

export function loadAllCorrections(executor: Executor = db) {
  return executor
    .select()
    .from(monthSettings)
    .orderBy(asc(monthSettings.month));
}

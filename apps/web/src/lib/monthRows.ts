import type {
  EntryInput,
  MonthRow,
  OneOffInput,
  PaymentStatus,
} from "@kkff/api/contracts";
import { buildSpd, type SpdResult } from "./spd";

/** Aktuální stav řádku jako vstup pro uložení, s případnými změnami. */
export function entryInputOf(
  row: MonthRow,
  changes: Partial<EntryInput> = {},
): EntryInput {
  return {
    status: row.status,
    paidOn: row.paidOn,
    note: row.note,
    ...row.overrides,
    ...changes,
  };
}

export function oneOffInputOf(
  row: MonthRow,
  changes: Partial<OneOffInput> = {},
): OneOffInput {
  return {
    ...entryInputOf(row),
    amount: row.amount,
    direction: row.direction,
    category: row.category,
    name: row.name,
    counterpartyId: row.counterparty?.id ?? null,
    ...changes,
  };
}

/** Změna stavu maže datum úhrady – u „Zaplaceno“ ho server doplní na dnešek. */
const statusChange = (status: PaymentStatus) => ({ status, paidOn: null });

export function itemEntryWithStatus(
  row: MonthRow,
  status: PaymentStatus,
): EntryInput {
  return entryInputOf(row, statusChange(status));
}

export function oneOffWithStatus(
  row: MonthRow,
  status: PaymentStatus,
): OneOffInput {
  return oneOffInputOf(row, statusChange(status));
}

export function isOverdue(row: MonthRow, today: string): boolean {
  return (
    row.direction === "expense" &&
    row.amount !== 0 &&
    row.status === "unpaid" &&
    row.dueDate != null &&
    row.dueDate < today
  );
}

/** Výdaje, které ještě čekají na zaplacení (kandidáti na QR). */
export function isPayable(row: MonthRow): boolean {
  return (
    row.direction === "expense" && row.amount > 0 && row.status === "unpaid"
  );
}

export function spdOf(row: MonthRow): SpdResult {
  return buildSpd({
    account: row.counterpartyAccount,
    amount: row.amount,
    vs: row.vs,
    ks: row.ks,
    ss: row.ss,
    message: row.message ?? row.name,
    recipientName: row.counterparty?.name ?? null,
  });
}

export interface CategoryGroup {
  category: string;
  rows: MonthRow[];
  plan: number;
  remaining: number;
}

export function groupByCategory(rows: MonthRow[]): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  for (const row of rows) {
    let group = groups.find((candidate) => candidate.category === row.category);
    if (!group) {
      group = { category: row.category, rows: [], plan: 0, remaining: 0 };
      groups.push(group);
    }
    group.rows.push(row);
    group.plan += row.amount;
    if (row.status !== "paid") {
      group.remaining += row.amount;
    }
  }
  return groups;
}

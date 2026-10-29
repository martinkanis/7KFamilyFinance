import type {
  ChangeableField,
  Direction,
  EntryInput,
  MonthRow,
  MonthView,
  NamedRef,
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

/** Okamžitá změna stavu v zobrazení, než odpoví server (souhrny přepočítá server). */
export function withOptimisticStatus(
  view: MonthView,
  rowKey: string,
  status: PaymentStatus,
  today: string,
): MonthView {
  return withRow(view, rowKey, (row) => ({
    ...row,
    status,
    paidOn: status === "paid" ? today : null,
  }));
}

/** Datum splatnosti v měsíci; den za koncem měsíce se posune na poslední den (jako na serveru). */
export function dueDateIn(month: string, day: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year ?? 0, monthNumber ?? 0, 0).getDate();
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

/** Hodnoty, které jdou změnit pro jeden měsíc i od měsíce dál. */
export const CHANGEABLE_FIELDS: ChangeableField[] = [
  "amount",
  "dueDay",
  "ourAccountId",
  "counterpartyAccount",
  "vs",
];

/**
 * Řádek po úpravě přímo v tabulce, než odpoví server. Návrat k výchozí
 * hodnotě (null) nechá zobrazenou hodnotu – výchozí hodnoty položky zná jen server.
 */
export function rowWithChanges(
  row: MonthRow,
  month: string,
  changes: Partial<EntryInput>,
  ourAccount?: NamedRef | null,
): MonthRow {
  const overrides = { ...row.overrides };
  for (const key of CHANGEABLE_FIELDS) {
    if (changes[key] !== undefined) {
      Object.assign(overrides, { [key]: changes[key] });
    }
  }
  const { amount, dueDay, counterpartyAccount, vs } = changes;
  return {
    ...row,
    overrides,
    amount: amount ?? row.amount,
    dueDate: dueDay == null ? row.dueDate : dueDateIn(month, dueDay),
    counterpartyAccount: counterpartyAccount ?? row.counterpartyAccount,
    vs: vs ?? row.vs,
    ourAccount:
      changes.ourAccountId != null && ourAccount !== undefined
        ? ourAccount
        : row.ourAccount,
    note: changes.note === undefined ? row.note : changes.note,
    paidOn: changes.paidOn === undefined ? row.paidOn : changes.paidOn,
  };
}

export function withRow(
  view: MonthView,
  rowKey: string,
  update: (row: MonthRow) => MonthRow,
): MonthView {
  return {
    ...view,
    rows: view.rows.map((row) => (row.key === rowKey ? update(row) : row)),
  };
}

export function withCategoryRenamed(
  view: MonthView,
  direction: Direction,
  from: string,
  to: string,
): MonthView {
  return {
    ...view,
    rows: view.rows.map((row) =>
      row.direction === direction && row.category === from
        ? { ...row, category: to }
        : row,
    ),
  };
}

/** Které měnitelné hodnoty úprava mění (null = návrat k výchozí se nepočítá). */
export function changedFieldsOf(
  changes: Partial<EntryInput>,
): ChangeableField[] {
  return CHANGEABLE_FIELDS.filter((field) => changes[field] != null);
}

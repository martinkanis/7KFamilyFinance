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

/** Skupiny podle kategorií; `categories` dá pořadí a přidá i prázdné kategorie. */
export function groupByCategory(
  rows: MonthRow[],
  categories: string[] = [],
): CategoryGroup[] {
  const groups: CategoryGroup[] = categories.map((category) => ({
    category,
    rows: [],
    plan: 0,
    remaining: 0,
  }));
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

export type SortBy = "own" | "due" | "amount" | "status";

export interface RowSort {
  by: SortBy;
  desc: boolean;
}

export const OWN_ORDER: RowSort = { by: "own", desc: false };

const STATUS_ORDER: Record<PaymentStatus, number> = {
  unpaid: 0,
  processing: 1,
  paid: 2,
};

/** Řazení uvnitř kategorie; prázdná splatnost je vždy na konci. */
export function sortRows(rows: MonthRow[], sort: RowSort): MonthRow[] {
  if (sort.by === "own") return rows;
  const sign = sort.desc ? -1 : 1;
  const compare = (a: MonthRow, b: MonthRow): number => {
    switch (sort.by) {
      case "due":
        if (a.dueDate == null || b.dueDate == null) {
          return Number(a.dueDate == null) - Number(b.dueDate == null);
        }
        return sign * a.dueDate.localeCompare(b.dueDate);
      case "amount":
        return sign * (a.amount - b.amount);
      default:
        return sign * (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    }
  };
  return [...rows].sort(compare);
}

export interface RowTarget {
  category: string;
  /** Řádek, vedle kterého se platba položí; null = na začátek kategorie. */
  anchorKey: string | null;
  after: boolean;
}

export interface RowRef {
  kind: "item" | "oneOff";
  id: number;
}

function refOf(row: MonthRow): RowRef | null {
  if (row.isOneOff) {
    return row.entryId == null ? null : { kind: "oneOff", id: row.entryId };
  }
  return row.itemId == null ? null : { kind: "item", id: row.itemId };
}

/**
 * Přesun platby po přetažení: nové řádky měsíce (pro okamžité zobrazení)
 * a pořadí plateb cílové kategorie (pro server).
 */
export function moveRow(
  rows: MonthRow[],
  rowKey: string,
  target: RowTarget,
): { rows: MonthRow[]; categoryRows: RowRef[] } | null {
  const dragged = rows.find((row) => row.key === rowKey);
  if (!dragged || dragged.key === target.anchorKey) return null;
  const moved = { ...dragged, category: target.category };
  const rest = rows.filter((row) => row.key !== rowKey);
  const inTarget = (row: MonthRow) =>
    row.direction === moved.direction && row.category === target.category;
  const categoryRows = rest.filter(inTarget);
  const anchorIndex = categoryRows.findIndex(
    (row) => row.key === target.anchorKey,
  );
  const insertAt = anchorIndex < 0 ? 0 : anchorIndex + (target.after ? 1 : 0);
  categoryRows.splice(insertAt, 0, moved);
  const firstIndex = rest.findIndex(inTarget);
  const others = rest.filter((row) => !inTarget(row));
  const blockAt = firstIndex < 0 ? others.length : firstIndex;
  return {
    rows: [
      ...others.slice(0, blockAt),
      ...categoryRows,
      ...others.slice(blockAt),
    ],
    categoryRows: categoryRows
      .map(refOf)
      .filter((ref): ref is RowRef => ref != null),
  };
}

/** Nové pořadí kategorií po přetažení `dragged` před/za `target`. */
export function moveCategory(
  names: string[],
  dragged: string,
  target: string,
  after: boolean,
): string[] | null {
  if (dragged === target) return null;
  const rest = names.filter((name) => name !== dragged);
  const index = rest.indexOf(target);
  if (index < 0) return null;
  rest.splice(index + (after ? 1 : 0), 0, dragged);
  return rest;
}

/** Hodnoty pro kopii platby (stav se nekopíruje – kopie je nezaplacená). */
export function copyOf(row: MonthRow) {
  return {
    direction: row.direction,
    category: row.category,
    name: row.name,
    amount: row.amount,
    dueDay: row.dueDate ? Number(row.dueDate.slice(8)) : null,
    ourAccountId: row.ourAccount?.id ?? null,
    counterpartyId: row.counterparty?.id ?? null,
    counterpartyAccount: row.counterpartyAccount,
    vs: row.vs,
    note: row.note,
    recurring: !row.isOneOff,
  };
}

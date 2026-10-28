import type {
  Account,
  AccountBreakdownRow,
  Counterparty,
  Direction,
  DirectionSummary,
  Item,
  MonthRow,
  MonthSummary,
  PaymentStatus,
  Template,
} from "../contracts.ts";
import { dueDateIn } from "./month.ts";
import { isItemDueInMonth } from "./schedule.ts";

/** Uložený záznam měsíce: stav a přepsání položky, nebo jednorázová platba (itemId = null). */
export interface MonthEntryRecord {
  id: number;
  month: string;
  itemId: number | null;
  status: PaymentStatus;
  paidOn: string | null;
  note: string | null;
  amount: number | null;
  dueDay: number | null;
  ourAccountId: number | null;
  counterpartyAccount: string | null;
  vs: string | null;
  name: string | null;
  direction: Direction | null;
  category: string | null;
  counterpartyId: number | null;
}

export interface PlannerCatalog {
  items: Item[];
  templates: Template[];
  counterparties: Counterparty[];
  accounts: Account[];
  insuranceReserve: number;
}

interface CatalogIndex {
  catalog: PlannerCatalog;
  templates: Map<number, Template>;
  counterparties: Map<number, Counterparty>;
  accounts: Map<number, Account>;
  categoryRank: Map<string, number>;
}

const ONE_OFF_CATEGORY = "Jednorázové";
const DIRECTION_ORDER: Direction[] = ["expense", "income"];

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function firstFilled(...values: (string | null | undefined)[]): string | null {
  return values.find((value) => value != null && value.trim() !== "") ?? null;
}

function indexById<T extends { id: number }>(rows: T[]): Map<number, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

function rankCategories(items: Item[]): Map<string, number> {
  const rank = new Map<string, number>();
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const item of sorted) {
    if (!rank.has(item.category)) {
      rank.set(item.category, rank.size);
    }
  }
  return rank;
}

export function indexCatalog(catalog: PlannerCatalog): CatalogIndex {
  return {
    catalog,
    templates: indexById(catalog.templates),
    counterparties: indexById(catalog.counterparties),
    accounts: indexById(catalog.accounts),
    categoryRank: rankCategories(catalog.items),
  };
}

export function insuranceReserveOf(annualAmounts: number[]): number {
  const total = annualAmounts.reduce((sum, amount) => sum + amount, 0);
  return roundMoney(total / 12);
}

function itemBaseAmount(
  item: Item,
  template: Template | undefined,
  insuranceReserve: number,
): number {
  if (item.amountFromInsurance) {
    return insuranceReserve;
  }
  return item.amount ?? template?.amount ?? 0;
}

function accountRef(index: CatalogIndex, id: number | null) {
  const account = id == null ? undefined : index.accounts.get(id);
  return account ? { id: account.id, name: account.name } : null;
}

function counterpartyRef(index: CatalogIndex, id: number | null) {
  const counterparty = id == null ? undefined : index.counterparties.get(id);
  return counterparty
    ? { id: counterparty.id, name: counterparty.name, web: counterparty.web }
    : null;
}

function overridesOf(entry: MonthEntryRecord | undefined) {
  return {
    amount: entry?.amount ?? null,
    dueDay: entry?.dueDay ?? null,
    ourAccountId: entry?.ourAccountId ?? null,
    counterpartyAccount: entry?.counterpartyAccount ?? null,
    vs: entry?.vs ?? null,
  };
}

function buildItemRow(
  month: string,
  item: Item,
  entry: MonthEntryRecord | undefined,
  index: CatalogIndex,
): MonthRow {
  const template =
    item.templateId == null ? undefined : index.templates.get(item.templateId);
  const counterparty = counterpartyRef(
    index,
    item.counterpartyId ?? template?.counterpartyId ?? null,
  );
  const isScheduled = isItemDueInMonth(item, month);
  const baseAmount = itemBaseAmount(
    item,
    template,
    index.catalog.insuranceReserve,
  );
  const dueDay = entry?.dueDay ?? (isScheduled ? item.dueDay : null);
  return {
    key: `item-${item.id}`,
    itemId: item.id,
    entryId: entry?.id ?? null,
    isOneOff: false,
    code: item.code,
    direction: item.direction,
    category: item.category,
    name: item.name,
    counterparty,
    template: template
      ? { id: template.id, name: template.name, code: template.code }
      : null,
    ourAccount: accountRef(index, entry?.ourAccountId ?? item.ourAccountId),
    counterpartyAccount: firstFilled(
      entry?.counterpartyAccount,
      item.counterpartyAccount,
      template?.accountNumber,
      counterparty
        ? index.counterparties.get(counterparty.id)?.accountNumber
        : null,
    ),
    vs: firstFilled(entry?.vs, item.vs, template?.vs),
    ks: firstFilled(item.ks, template?.ks),
    ss: firstFilled(item.ss, template?.ss),
    message: firstFilled(item.message, template?.message),
    dueDate: dueDay == null ? null : dueDateIn(month, dueDay),
    amount: roundMoney(entry?.amount ?? (isScheduled ? baseAmount : 0)),
    isScheduled,
    status: entry?.status ?? "unpaid",
    paidOn: entry?.paidOn ?? null,
    note: entry?.note ?? null,
    savings: item.savings,
    overrides: overridesOf(entry),
  };
}

function buildOneOffRow(
  month: string,
  entry: MonthEntryRecord,
  index: CatalogIndex,
): MonthRow {
  const counterparty = counterpartyRef(index, entry.counterpartyId);
  return {
    key: `entry-${entry.id}`,
    itemId: null,
    entryId: entry.id,
    isOneOff: true,
    code: null,
    direction: entry.direction ?? "expense",
    category: entry.category ?? ONE_OFF_CATEGORY,
    name: entry.name ?? "",
    counterparty,
    template: null,
    ourAccount: accountRef(index, entry.ourAccountId),
    counterpartyAccount: firstFilled(
      entry.counterpartyAccount,
      counterparty
        ? index.counterparties.get(counterparty.id)?.accountNumber
        : null,
    ),
    vs: entry.vs,
    ks: null,
    ss: null,
    message: null,
    dueDate: entry.dueDay == null ? null : dueDateIn(month, entry.dueDay),
    amount: roundMoney(entry.amount ?? 0),
    isScheduled: true,
    status: entry.status,
    paidOn: entry.paidOn,
    note: entry.note,
    savings: false,
    overrides: overridesOf(entry),
  };
}

function compareRows(index: CatalogIndex) {
  const unknownRank = Number.MAX_SAFE_INTEGER;
  const sortOrderOf = new Map(
    index.catalog.items.map((item) => [item.id, item.sortOrder]),
  );
  return (a: MonthRow, b: MonthRow): number =>
    DIRECTION_ORDER.indexOf(a.direction) -
      DIRECTION_ORDER.indexOf(b.direction) ||
    (index.categoryRank.get(a.category) ?? unknownRank) -
      (index.categoryRank.get(b.category) ?? unknownRank) ||
    a.category.localeCompare(b.category, "cs", { numeric: true }) ||
    Number(a.isOneOff) - Number(b.isOneOff) ||
    (sortOrderOf.get(a.itemId ?? -1) ?? 0) -
      (sortOrderOf.get(b.itemId ?? -1) ?? 0) ||
    (a.entryId ?? 0) - (b.entryId ?? 0);
}

/** Řádky měsíce: aktivní položky (i nesplatné, s částkou 0), položky se záznamem a jednorázové platby. */
export function buildMonthRows(
  month: string,
  index: CatalogIndex,
  entries: MonthEntryRecord[],
): MonthRow[] {
  const entryByItem = new Map(
    entries
      .filter((entry) => entry.itemId != null)
      .map((entry) => [entry.itemId, entry]),
  );
  const itemRows = index.catalog.items
    .filter((item) => item.active || entryByItem.has(item.id))
    .map((item) => buildItemRow(month, item, entryByItem.get(item.id), index));
  const oneOffRows = entries
    .filter((entry) => entry.itemId == null)
    .map((entry) => buildOneOffRow(month, entry, index));
  return [...itemRows, ...oneOffRows].sort(compareRows(index));
}

function sumAmounts(rows: MonthRow[]): number {
  return roundMoney(rows.reduce((sum, row) => sum + row.amount, 0));
}

function summarizeDirection(
  rows: MonthRow[],
  direction: Direction,
): DirectionSummary {
  const relevant = rows.filter((row) => row.direction === direction);
  const plan = sumAmounts(relevant);
  const paid = sumAmounts(relevant.filter((row) => row.status === "paid"));
  const processing = sumAmounts(
    relevant.filter((row) => row.status === "processing"),
  );
  return { plan, paid, processing, remaining: roundMoney(plan - paid) };
}

/** Úspory jsou výdaj z cashflow, ale v majetku zůstávají – proto se ke změně majetku přičítají. */
export function summarizeMonth(rows: MonthRow[]): MonthSummary {
  const income = summarizeDirection(rows, "income");
  const expense = summarizeDirection(rows, "expense");
  const balance = roundMoney(income.plan - expense.plan);
  const savings = sumAmounts(
    rows.filter((row) => row.direction === "expense" && row.savings),
  );
  return {
    income,
    expense,
    balance,
    savings,
    wealthChange: roundMoney(balance + savings),
  };
}

function breakdownRow(
  accountId: number | null,
  name: string,
  owner: string | null,
  rows: MonthRow[],
): AccountBreakdownRow {
  const expenses = rows.filter((row) => row.direction === "expense");
  const incomes = rows.filter((row) => row.direction === "income");
  const unpaid = (row: MonthRow) => row.status !== "paid";
  return {
    accountId,
    name,
    owner,
    expensePlan: sumAmounts(expenses),
    expenseRemaining: sumAmounts(expenses.filter(unpaid)),
    incomePlan: sumAmounts(incomes),
    incomeRemaining: sumAmounts(incomes.filter(unpaid)),
  };
}

function hasAnyAmount(row: AccountBreakdownRow): boolean {
  return row.expensePlan !== 0 || row.incomePlan !== 0;
}

/** Kolik z kterého našeho účtu odchází a přichází; účty bez pohybu se vynechají. */
export function breakdownByAccount(
  rows: MonthRow[],
  accounts: Account[],
): AccountBreakdownRow[] {
  const byAccount = [...accounts]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((account) =>
      breakdownRow(
        account.id,
        account.name,
        account.owner,
        rows.filter((row) => row.ourAccount?.id === account.id),
      ),
    );
  const withoutAccount = breakdownRow(
    null,
    "Bez vyplněného účtu",
    null,
    rows.filter((row) => row.ourAccount == null),
  );
  return [...byAccount, withoutAccount].filter(hasAnyAmount);
}

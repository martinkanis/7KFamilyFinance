import type {
  AccountBalance,
  MonthRow,
  MonthSummary,
  MonthView,
  Overview,
  OverviewMonth,
  Settings,
} from "../../contracts.ts";
import { actualWealthByMonth } from "../../domain/balances.ts";
import { buildCategoryMatrix } from "../../domain/matrix.ts";
import { monthKeyOfDate } from "../../domain/month.ts";
import {
  breakdownByAccount,
  buildMonthRows,
  indexCatalog,
  type MonthEntryRecord,
  type PlannerCatalog,
  roundMoney,
  summarizeMonth,
} from "../../domain/planner.ts";
import {
  computeWealth,
  overviewMonthRange,
  type WealthPoint,
} from "../../domain/wealth.ts";
import { todayInPrague } from "../../lib/today.ts";
import { loadBalances } from "../balances/service.ts";
import { loadSettings } from "../catalog/settings.ts";
import {
  loadAllCorrections,
  loadAllEntries,
  loadPlannerCatalog,
} from "../planning/catalog.ts";

function groupByMonth(
  entries: MonthEntryRecord[],
): Map<string, MonthEntryRecord[]> {
  const groups = new Map<string, MonthEntryRecord[]>();
  for (const entry of entries) {
    groups.set(entry.month, [...(groups.get(entry.month) ?? []), entry]);
  }
  return groups;
}

interface OverviewMonthInput {
  month: string;
  summary: MonthSummary;
  correction: number;
  wealth: WealthPoint;
  actualWealth: number | null;
}

function toOverviewMonth(input: OverviewMonthInput): OverviewMonth {
  const { income, expense } = input.summary;
  return {
    month: input.month,
    incomePlan: income.plan,
    incomePaid: income.paid,
    expensePlan: expense.plan,
    expensePaid: expense.paid,
    expenseRemaining: expense.remaining,
    balance: input.summary.balance,
    savings: input.summary.savings,
    correction: input.correction,
    wealthStart: input.wealth.wealthStart,
    wealthEnd: input.wealth.wealthEnd,
    actualWealth: input.actualWealth,
    paidRatio: expense.plan === 0 ? null : expense.paid / expense.plan,
  };
}

export interface PlanSnapshot {
  overview: Overview;
  monthViews: MonthView[];
  catalog: PlannerCatalog;
  settings: Settings;
  balances: AccountBalance[];
}

export async function getOverview(): Promise<Overview> {
  return (await computePlanSnapshot()).overview;
}

/** Celý plán přes rozsah přehledu – pro přehled i export do Excelu. */
export async function computePlanSnapshot(): Promise<PlanSnapshot> {
  const [catalog, entries, corrections, settings, balances] = await Promise.all(
    [
      loadPlannerCatalog(),
      loadAllEntries(),
      loadAllCorrections(),
      loadSettings(),
      loadBalances(),
    ],
  );
  const index = indexCatalog(catalog);
  const correctionOf = new Map(
    corrections.map((row) => [row.month, row.wealthCorrection]),
  );
  const correctionNoteOf = new Map(
    corrections.map((row) => [row.month, row.note]),
  );
  const actualWealthOf = actualWealthByMonth(balances);
  const months = overviewMonthRange({
    startDate: settings.startDate,
    usedMonths: [
      ...entries.map((entry) => entry.month),
      ...correctionOf.keys(),
      ...actualWealthOf.keys(),
    ],
    currentMonth: monthKeyOfDate(todayInPrague()),
  });
  const entriesByMonth = groupByMonth(entries);
  const rowsByMonth = months.map((month) =>
    buildMonthRows(month, index, entriesByMonth.get(month) ?? []),
  );
  const summaries = rowsByMonth.map(summarizeMonth);
  const initialWealth = roundMoney(
    catalog.accounts.reduce((sum, account) => sum + account.initialBalance, 0),
  );
  const wealth = computeWealth(
    months.map((month, i) => ({
      month,
      wealthChange: summaries[i]?.wealthChange ?? 0,
      correction: correctionOf.get(month) ?? 0,
    })),
    settings.startDate,
    initialWealth,
  );
  const overview: Overview = {
    startDate: settings.startDate,
    initialWealth,
    months: months.map((month, i) =>
      toOverviewMonth({
        month,
        summary: summaries[i] ?? summarizeMonth([]),
        correction: correctionOf.get(month) ?? 0,
        wealth: wealth[i] ?? { wealthStart: null, wealthEnd: null },
        actualWealth: actualWealthOf.get(month) ?? null,
      }),
    ),
    expenseMatrix: buildCategoryMatrix("expense", rowsByMonth),
    incomeMatrix: buildCategoryMatrix("income", rowsByMonth),
  };
  const monthViews = months.map((month, i) =>
    toMonthView({
      month,
      rows: rowsByMonth[i] ?? [],
      catalog,
      correction: {
        amount: correctionOf.get(month) ?? 0,
        note: correctionNoteOf.get(month) ?? null,
      },
    }),
  );
  return { overview, monthViews, catalog, settings, balances };
}

function toMonthView(input: {
  month: string;
  rows: MonthRow[];
  catalog: PlannerCatalog;
  correction: MonthView["correction"];
}): MonthView {
  return {
    month: input.month,
    rows: input.rows,
    summary: summarizeMonth(input.rows),
    accounts: breakdownByAccount(input.rows, input.catalog.accounts),
    correction: input.correction,
  };
}

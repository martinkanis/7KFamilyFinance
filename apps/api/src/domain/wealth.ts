import { addMonths, firstDayOf, monthKeyOfDate, monthRange } from "./month.ts";
import { roundMoney } from "./planner.ts";

export interface WealthInput {
  month: string;
  wealthChange: number;
  correction: number;
}

export interface WealthPoint {
  wealthStart: number | null;
  wealthEnd: number | null;
}

/**
 * Majetek na začátku prvního měsíce od data počátečního stavu = součet počátečních
 * stavů účtů; každý další měsíc začíná koncem předchozího. Měsíce před tím datem
 * majetek nemají.
 */
export function computeWealth(
  months: WealthInput[],
  startDate: string | null,
  initialWealth: number,
): WealthPoint[] {
  let previousEnd: number | null = null;
  return months.map((month) => {
    if (startDate == null || firstDayOf(month.month) < startDate) {
      previousEnd = null;
      return { wealthStart: null, wealthEnd: null };
    }
    const wealthStart: number = previousEnd ?? initialWealth;
    const wealthEnd = roundMoney(
      wealthStart + month.wealthChange + month.correction,
    );
    previousEnd = wealthEnd;
    return { wealthStart, wealthEnd };
  });
}

const PLANNED_MONTHS_AFTER_START = 13;
const PLANNED_MONTHS_AFTER_TODAY = 6;

/** Rozsah přehledu: od počátku (nebo nejstaršího záznamu) aspoň 14 měsíců dopředu. */
export function overviewMonthRange(options: {
  startDate: string | null;
  usedMonths: string[];
  currentMonth: string;
}): string[] {
  const startMonth = options.startDate
    ? monthKeyOfDate(options.startDate)
    : options.currentMonth;
  const from = [startMonth, ...options.usedMonths].sort()[0] ?? startMonth;
  const to =
    [
      addMonths(startMonth, PLANNED_MONTHS_AFTER_START),
      addMonths(options.currentMonth, PLANNED_MONTHS_AFTER_TODAY),
      ...options.usedMonths,
    ]
      .sort()
      .at(-1) ?? startMonth;
  return monthRange(from, to);
}

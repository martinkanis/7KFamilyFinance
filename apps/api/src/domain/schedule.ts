import { firstDayOf, lastDayOf, monthNumber } from "./month.ts";

export interface ScheduleFields {
  active: boolean;
  dueMonths: string | null;
  validFrom: string | null;
  validTo: string | null;
}

export class InvalidDueMonthsError extends Error {
  constructor(value: string) {
    super(
      `Neplatné měsíce splatnosti „${value}“ – zadej čísla 1–12 oddělená čárkou, např. „3,9“`,
    );
  }
}

/** „3, 9“ / „3;9“ → [3, 9]; prázdná hodnota = splatné každý měsíc (null). */
export function parseDueMonths(value: string | null): number[] | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "") {
    return null;
  }
  const months = trimmed.split(/[,;]/).map((token) => Number(token.trim()));
  const isValid = months.every(
    (month) => Number.isInteger(month) && month >= 1 && month <= 12,
  );
  if (!isValid) {
    throw new InvalidDueMonthsError(value ?? "");
  }
  return months;
}

export function isItemDueInMonth(item: ScheduleFields, month: string): boolean {
  if (!item.active) {
    return false;
  }
  const dueMonths = parseDueMonths(item.dueMonths);
  if (dueMonths && !dueMonths.includes(monthNumber(month))) {
    return false;
  }
  const startsAfterMonth = item.validFrom && item.validFrom > lastDayOf(month);
  const endsBeforeMonth = item.validTo && item.validTo < firstDayOf(month);
  return !startsAfterMonth && !endsBeforeMonth;
}

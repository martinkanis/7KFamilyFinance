import { addMonths, firstDayOf, lastDayOf, monthNumber } from "./month.ts";

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

export type ItemEnding = { kind: "delete" } | { kind: "end"; validTo: string };

/**
 * Ukončení položky od měsíce: platí do konce předchozího měsíce, takže minulé
 * měsíce zůstanou i s historií. Když položka začíná až v tomto měsíci nebo
 * později, nikde jinde by nebyla vidět – smaže se celá.
 */
export function endingFrom(
  item: Pick<ScheduleFields, "validFrom" | "validTo">,
  month: string,
): ItemEnding {
  if (item.validFrom && item.validFrom >= firstDayOf(month)) {
    return { kind: "delete" };
  }
  const lastValid = lastDayOf(addMonths(month, -1));
  const validTo =
    item.validTo && item.validTo < lastValid ? item.validTo : lastValid;
  return { kind: "end", validTo };
}

const CODE_PREFIX = { expense: "V", income: "P" } as const;

/** Další volné ID položky: „V“ u výdajů, „P“ u příjmů, číslo o jedna vyšší než nejvyšší. */
export function nextItemCode(
  direction: keyof typeof CODE_PREFIX,
  existingCodes: string[],
): string {
  const prefix = CODE_PREFIX[direction];
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  const highest = existingCodes.reduce((max, code) => {
    const match = pattern.exec(code);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  let next = highest + 1;
  const taken = new Set(existingCodes);
  while (taken.has(`${prefix}${String(next).padStart(2, "0")}`)) next++;
  return `${prefix}${String(next).padStart(2, "0")}`;
}

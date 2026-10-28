// Měsíc se v celé aplikaci identifikuje klíčem „YYYY-MM“; data jsou ISO „YYYY-MM-DD“.

const MONTH_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const ISO_DATE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isMonthKey(value: string): boolean {
  return MONTH_KEY_PATTERN.test(value);
}

export function isIsoDate(value: string): boolean {
  return ISO_DATE_PATTERN.test(value);
}

function parseMonthKey(key: string): { year: number; month: number } {
  const match = MONTH_KEY_PATTERN.exec(key);
  if (!match) {
    throw new Error(`Neplatný měsíc „${key}“, očekávám YYYY-MM`);
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthKeyOfDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function monthNumber(key: string): number {
  return parseMonthKey(key).month;
}

export function addMonths(key: string, delta: number): string {
  const { year, month } = parseMonthKey(key);
  const zeroBased = year * 12 + (month - 1) + delta;
  return toMonthKey(Math.floor(zeroBased / 12), (zeroBased % 12) + 1);
}

export function daysInMonth(key: string): number {
  const { year, month } = parseMonthKey(key);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function firstDayOf(key: string): string {
  return `${key}-01`;
}

export function lastDayOf(key: string): string {
  return `${key}-${String(daysInMonth(key)).padStart(2, "0")}`;
}

/** Den splatnosti v měsíci; 31. v kratším měsíci = poslední den měsíce. */
export function dueDateIn(key: string, day: number): string {
  const clamped = Math.min(Math.max(day, 1), daysInMonth(key));
  return `${key}-${String(clamped).padStart(2, "0")}`;
}

export function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  for (let key = from; key <= to; key = addMonths(key, 1)) {
    months.push(key);
  }
  return months;
}

export function currentMonthKey(today: Date = new Date()): string {
  return toMonthKey(today.getFullYear(), today.getMonth() + 1);
}

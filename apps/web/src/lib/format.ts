import type { PaymentStatus } from "@kkff/api/contracts";

const MONEY = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  maximumFractionDigits: 0,
});

const MONEY_PRECISE = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MONTH_NAMES = [
  "Leden",
  "Únor",
  "Březen",
  "Duben",
  "Květen",
  "Červen",
  "Červenec",
  "Srpen",
  "Září",
  "Říjen",
  "Listopad",
  "Prosinec",
];

export const STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Nezaplaceno",
  processing: "Zpracovává se",
  paid: "Zaplaceno",
};

export function formatMoney(amount: number | null | undefined): string {
  if (amount == null) {
    return "–";
  }
  return Number.isInteger(amount)
    ? MONEY.format(amount)
    : MONEY_PRECISE.format(amount);
}

export function formatDate(isoDate: string | null): string {
  if (!isoDate) {
    return "";
  }
  const [year, month, day] = isoDate.split("-");
  return `${Number(day)}. ${Number(month)}. ${year}`;
}

export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `${MONTH_NAMES[Number(monthNumber) - 1]} ${year}`;
}

export function shortMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `${Number(monthNumber)}/${year?.slice(2)}`;
}

export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const zeroBased = (year ?? 0) * 12 + (monthNumber ?? 1) - 1 + delta;
  const nextMonth = String((zeroBased % 12) + 1).padStart(2, "0");
  return `${Math.floor(zeroBased / 12)}-${nextMonth}`;
}

export function currentMonth(today: Date = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

export function todayIso(today: Date = new Date()): string {
  return `${currentMonth(today)}-${String(today.getDate()).padStart(2, "0")}`;
}

/** Jen http(s) odkazy – javascript: a podobné se nevykreslí. */
export function safeUrl(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

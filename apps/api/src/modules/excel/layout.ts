import type { Direction, PaymentStatus } from "../../contracts.ts";

// Rozložení listů odpovídá sešitu „MonkeyBusiness 2.0.xlsx“, takže export jde zpět importovat.

export const SHEETS = {
  overview: "Přehled",
  items: "Položky",
  accounts: "Účty",
  counterparties: "Protistrany",
  templates: "Šablony",
  insurance: "Pojistky",
  balances: "Stav účtů",
} as const;

export const MONTH_SHEET_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: "Zaplaceno",
  processing: "Zpracovává se",
  unpaid: "Nezaplaceno",
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  expense: "Výdaj",
  income: "Příjem",
};

export const YES = "Ano";
export const NO = "Ne";

export const TABLE_HEADER_ROW = 4;
export const FIRST_TABLE_ROW = 5;
export const INSURANCE_HEADER_ROW = 3;
export const FIRST_INSURANCE_ROW = 4;
export const MONTH_FIRST_ROW = 9;
export const OVERVIEW_HEADER_ROW = 5;
export const OVERVIEW_FIRST_ROW = 6;
export const START_DATE_CELL = "C2";

export const ACCOUNT_COLUMNS = {
  name: 1,
  institution: 2,
  owner: 3,
  type: 4,
  number: 5,
  currency: 6,
  initialBalance: 7,
  note: 8,
} as const;

export const COUNTERPARTY_COLUMNS = {
  name: 1,
  type: 2,
  accountNumber: 3,
  web: 4,
  contact: 5,
  note: 6,
} as const;

export const TEMPLATE_COLUMNS = {
  key: 1,
  code: 2,
  name: 3,
  bankLogin: 4,
  counterparty: 5,
  accountNumber: 6,
  vs: 7,
  ks: 8,
  ss: 9,
  message: 10,
  amount: 11,
  timesUsed: 12,
  knownAccount: 13,
  verified: 14,
  note: 15,
} as const;

export const INSURANCE_COLUMNS = { name: 1, annualAmount: 2, note: 3 } as const;

export const ITEM_COLUMNS = {
  code: 1,
  direction: 2,
  category: 3,
  name: 4,
  amount: 5,
  dueDay: 6,
  dueMonths: 7,
  validFrom: 8,
  validTo: 9,
  ourAccount: 10,
  counterparty: 11,
  template: 12,
  counterpartyAccount: 13,
  vs: 14,
  ks: 15,
  ss: 16,
  message: 17,
  savings: 18,
  active: 19,
  note: 20,
} as const;

export const MONTH_COLUMNS = {
  code: 1,
  name: 2,
  counterparty: 3,
  template: 4,
  ourAccount: 5,
  counterpartyAccount: 6,
  vs: 7,
  dueDate: 8,
  amount: 9,
  status: 10,
  paidOn: 11,
  note: 12,
  overrideAmount: 14,
  overrideDueDay: 15,
  overrideOurAccount: 16,
  overrideCounterpartyAccount: 17,
  overrideVs: 18,
  direction: 20,
  category: 21,
} as const;

/** Součtový řádek listu „Stav účtů“ – import ho přeskočí. */
export const BALANCE_TOTAL_LABEL = "Celkem";

export const OVERVIEW_COLUMNS = { month: 1, correction: 10 } as const;

const TEMPLATE_KEY_SEPARATOR = " – ";

export function templateKey(code: string, name: string): string {
  return `${code}${TEMPLATE_KEY_SEPARATOR}${name}`;
}

export function templateCodeFromKey(key: string): string {
  return key.split(TEMPLATE_KEY_SEPARATOR)[0]?.trim() ?? key.trim();
}

export function insuranceReserveFormula(reserveRow: number): string {
  return `'${SHEETS.insurance}'!$B$${reserveRow}`;
}

export function isInsuranceReserveFormula(formula: string): boolean {
  return formula.includes(SHEETS.insurance);
}

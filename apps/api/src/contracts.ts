// Datové kontrakty API ↔ web. Jen typy – web je importuje přes `@kkff/api/contracts`.

export type Direction = "expense" | "income";
export type PaymentStatus = "unpaid" | "processing" | "paid";

export interface Account {
  id: number;
  name: string;
  institution: string | null;
  owner: string | null;
  type: string | null;
  number: string | null;
  currency: string;
  initialBalance: number;
  note: string | null;
  sortOrder: number;
}

export interface Counterparty {
  id: number;
  name: string;
  type: string | null;
  accountNumber: string | null;
  web: string | null;
  contact: string | null;
  note: string | null;
}

export interface Template {
  id: number;
  code: string;
  name: string;
  bankLogin: string | null;
  counterpartyId: number | null;
  accountNumber: string | null;
  vs: string | null;
  ks: string | null;
  ss: string | null;
  message: string | null;
  amount: number | null;
  timesUsed: number | null;
  knownAccount: boolean;
  verified: boolean;
  note: string | null;
}

export interface InsurancePolicy {
  id: number;
  name: string;
  annualAmount: number;
  note: string | null;
}

export interface Item {
  id: number;
  code: string;
  direction: Direction;
  category: string;
  name: string;
  /** null = částka ze šablony */
  amount: number | null;
  /** true = částka je měsíční rezerva z ročních pojistek */
  amountFromInsurance: boolean;
  dueDay: number | null;
  /** null = každý měsíc, jinak čísla měsíců oddělená čárkou („3,9“) */
  dueMonths: string | null;
  validFrom: string | null;
  validTo: string | null;
  ourAccountId: number | null;
  counterpartyId: number | null;
  templateId: number | null;
  counterpartyAccount: string | null;
  vs: string | null;
  ks: string | null;
  ss: string | null;
  message: string | null;
  savings: boolean;
  active: boolean;
  note: string | null;
  sortOrder: number;
}

export type AccountInput = Omit<Account, "id">;
export type CounterpartyInput = Omit<Counterparty, "id">;
export type TemplateInput = Omit<Template, "id">;
export type InsurancePolicyInput = Omit<InsurancePolicy, "id">;
export type ItemInput = Omit<Item, "id">;

export interface Settings {
  startDate: string | null;
}

/** Hodnoty přepsané jen pro jeden měsíc (null = výchozí z položky). */
export interface MonthOverrides {
  amount: number | null;
  dueDay: number | null;
  ourAccountId: number | null;
  counterpartyAccount: string | null;
  vs: string | null;
}

export interface EntryInput extends MonthOverrides {
  status: PaymentStatus;
  paidOn: string | null;
  note: string | null;
}

export interface OneOffInput extends EntryInput {
  direction: Direction;
  category: string;
  name: string;
  counterpartyId: number | null;
}

export interface NamedRef {
  id: number;
  name: string;
}

export interface MonthRow {
  key: string;
  itemId: number | null;
  entryId: number | null;
  isOneOff: boolean;
  code: string | null;
  direction: Direction;
  category: string;
  name: string;
  counterparty: (NamedRef & { web: string | null }) | null;
  template: (NamedRef & { code: string }) | null;
  ourAccount: NamedRef | null;
  counterpartyAccount: string | null;
  vs: string | null;
  ks: string | null;
  ss: string | null;
  message: string | null;
  dueDate: string | null;
  amount: number;
  /** Položka je v tomto měsíci podle plánu splatná. */
  isScheduled: boolean;
  status: PaymentStatus;
  paidOn: string | null;
  note: string | null;
  savings: boolean;
  overrides: MonthOverrides;
}

export interface DirectionSummary {
  plan: number;
  paid: number;
  processing: number;
  remaining: number;
}

export interface MonthSummary {
  income: DirectionSummary;
  expense: DirectionSummary;
  balance: number;
  savings: number;
  wealthChange: number;
}

export interface AccountBreakdownRow {
  accountId: number | null;
  name: string;
  owner: string | null;
  expensePlan: number;
  expenseRemaining: number;
  incomePlan: number;
  incomeRemaining: number;
}

export interface MonthCorrection {
  amount: number;
  note: string | null;
}

export interface MonthView {
  month: string;
  rows: MonthRow[];
  summary: MonthSummary;
  accounts: AccountBreakdownRow[];
  correction: MonthCorrection;
}

export interface OverviewMonth {
  month: string;
  incomePlan: number;
  incomePaid: number;
  expensePlan: number;
  expensePaid: number;
  expenseRemaining: number;
  balance: number;
  savings: number;
  correction: number;
  wealthStart: number | null;
  wealthEnd: number | null;
  /** Zaplacená část výdajů 0–1, null když měsíc nemá výdaje. */
  paidRatio: number | null;
}

export interface CategoryMatrixRow {
  category: string;
  amounts: number[];
  total: number;
}

export interface CategoryMatrix {
  direction: Direction;
  rows: CategoryMatrixRow[];
}

export interface Overview {
  startDate: string | null;
  initialWealth: number;
  months: OverviewMonth[];
  expenseMatrix: CategoryMatrix;
  incomeMatrix: CategoryMatrix;
}

export interface ImportResult {
  counts: Record<string, number>;
  warnings: string[];
}

export interface CurrentUser {
  username: string;
}

export interface ApiErrorBody {
  error: string;
}

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const directionEnum = pgEnum("direction", ["expense", "income"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "unpaid",
  "processing",
  "paid",
]);

const money = () => numeric({ precision: 14, scale: 2, mode: "number" });
const isoDate = () => date({ mode: "string" });

/** Jediný řádek s nastavením aplikace (id = 1). */
export const appSettings = pgTable("app_settings", {
  id: integer().primaryKey().default(1),
  startDate: isoDate(),
});

export const serverSecrets = pgTable("server_secrets", {
  name: text().primaryKey(),
  value: text().notNull(),
});

export const accounts = pgTable("accounts", {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  institution: text(),
  owner: text(),
  type: text(),
  number: text(),
  /** Platí se z něj / chodí na něj platby (ne jen místo, kde máme peníze). */
  paymentAccount: boolean().notNull().default(false),
  currency: text().notNull().default("CZK"),
  initialBalance: money().notNull().default(0),
  note: text(),
  sortOrder: integer().notNull().default(0),
});

export const counterparties = pgTable("counterparties", {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  type: text(),
  accountNumber: text(),
  web: text(),
  contact: text(),
  note: text(),
});

export const templates = pgTable("templates", {
  id: serial().primaryKey(),
  code: text().notNull().unique(),
  name: text().notNull(),
  bankLogin: text(),
  counterpartyId: integer().references(() => counterparties.id, {
    onDelete: "set null",
  }),
  accountNumber: text(),
  vs: text(),
  ks: text(),
  ss: text(),
  message: text(),
  amount: money(),
  timesUsed: integer(),
  knownAccount: boolean().notNull().default(false),
  verified: boolean().notNull().default(false),
  note: text(),
});

export const insurancePolicies = pgTable("insurance_policies", {
  id: serial().primaryKey(),
  name: text().notNull(),
  annualAmount: money().notNull().default(0),
  note: text(),
});

export const items = pgTable(
  "items",
  {
    id: serial().primaryKey(),
    code: text().notNull().unique(),
    direction: directionEnum().notNull(),
    category: text().notNull(),
    name: text().notNull(),
    amount: money(),
    amountFromInsurance: boolean().notNull().default(false),
    dueDay: integer(),
    dueMonths: text(),
    validFrom: isoDate(),
    validTo: isoDate(),
    ourAccountId: integer().references(() => accounts.id, {
      onDelete: "set null",
    }),
    counterpartyId: integer().references(() => counterparties.id, {
      onDelete: "set null",
    }),
    templateId: integer().references(() => templates.id, {
      onDelete: "set null",
    }),
    counterpartyAccount: text(),
    vs: text(),
    ks: text(),
    ss: text(),
    message: text(),
    savings: boolean().notNull().default(false),
    active: boolean().notNull().default(true),
    note: text(),
    sortOrder: integer().notNull().default(0),
  },
  (table) => [
    check(
      "items_due_day_range",
      sql`${table.dueDay} is null or ${table.dueDay} between 1 and 31`,
    ),
  ],
);

/** Stav a přepsání položky v měsíci; bez itemId jde o jednorázovou platbu. */
export const monthEntries = pgTable(
  "month_entries",
  {
    id: serial().primaryKey(),
    month: text().notNull(),
    itemId: integer().references(() => items.id, { onDelete: "cascade" }),
    status: paymentStatusEnum().notNull().default("unpaid"),
    paidOn: isoDate(),
    note: text(),
    amount: money(),
    dueDay: integer(),
    ourAccountId: integer().references(() => accounts.id, {
      onDelete: "set null",
    }),
    counterpartyAccount: text(),
    vs: text(),
    name: text(),
    direction: directionEnum(),
    category: text(),
    counterpartyId: integer().references(() => counterparties.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("month_entries_month_item").on(table.month, table.itemId),
    check(
      "month_entries_month_format",
      sql`${table.month} ~ '^\\d{4}-\\d{2}$'`,
    ),
    check(
      "month_entries_one_off_complete",
      sql`${table.itemId} is not null or (${table.name} is not null and ${table.direction} is not null)`,
    ),
    check(
      "month_entries_due_day_range",
      sql`${table.dueDay} is null or ${table.dueDay} between 1 and 31`,
    ),
  ],
);

export const monthSettings = pgTable("month_settings", {
  month: text().primaryKey(),
  wealthCorrection: money().notNull().default(0),
  note: text(),
});

/** Skutečný zůstatek účtu zapsaný při měsíční kontrole (blok „Stávající stav“ v Excelu). */
export const accountBalances = pgTable(
  "account_balances",
  {
    id: serial().primaryKey(),
    accountId: integer()
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    month: text().notNull(),
    balance: money().notNull(),
  },
  (table) => [
    uniqueIndex("account_balances_account_month").on(
      table.accountId,
      table.month,
    ),
    check(
      "account_balances_month_format",
      sql`${table.month} ~ '^\\d{4}-\\d{2}$'`,
    ),
  ],
);

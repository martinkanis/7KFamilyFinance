import type { Account, Counterparty, Item, Template } from "../contracts.ts";
import type { MonthEntryRecord } from "./planner.ts";

export function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 1,
    code: "V01",
    direction: "expense",
    category: "1. Bydlení",
    name: "Nájem",
    amount: 1000,
    amountFromInsurance: false,
    dueDay: null,
    dueMonths: null,
    validFrom: null,
    validTo: null,
    ourAccountId: null,
    counterpartyId: null,
    templateId: null,
    counterpartyAccount: null,
    vs: null,
    ks: null,
    ss: null,
    message: null,
    savings: false,
    active: true,
    note: null,
    sortOrder: 1,
    ...overrides,
  };
}

export function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: 1,
    code: "E01",
    name: "Šablona",
    bankLogin: null,
    counterpartyId: null,
    accountNumber: "19-2000145399/0800",
    vs: "111",
    ks: "0308",
    ss: null,
    message: "zpráva ze šablony",
    amount: 500,
    timesUsed: null,
    knownAccount: false,
    verified: false,
    note: null,
    ...overrides,
  };
}

export function makeCounterparty(
  overrides: Partial<Counterparty> = {},
): Counterparty {
  return {
    id: 1,
    name: "Dodavatel",
    type: null,
    accountNumber: "1234567890/0100",
    web: "https://example.cz",
    contact: null,
    note: null,
    ...overrides,
  };
}

export function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 1,
    name: "Air – společný",
    institution: "Air Bank",
    owner: "Společné",
    type: "Bankovní účet",
    number: null,
    kind: "operating",
    currency: "CZK",
    initialBalance: 0,
    note: null,
    sortOrder: 1,
    ...overrides,
  };
}

export function makeEntry(
  overrides: Partial<MonthEntryRecord> = {},
): MonthEntryRecord {
  return {
    id: 1,
    month: "2026-11",
    itemId: 1,
    status: "unpaid",
    paidOn: null,
    note: null,
    amount: null,
    dueDay: null,
    ourAccountId: null,
    counterpartyAccount: null,
    vs: null,
    name: null,
    direction: null,
    category: null,
    counterpartyId: null,
    ...overrides,
  };
}

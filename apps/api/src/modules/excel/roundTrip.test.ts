import { describe, expect, it } from "bun:test";
import type { MonthView, Overview } from "../../contracts.ts";
import {
  breakdownByAccount,
  buildMonthRows,
  indexCatalog,
  type PlannerCatalog,
  summarizeMonth,
} from "../../domain/planner.ts";
import {
  makeAccount,
  makeCounterparty,
  makeEntry,
  makeItem,
  makeTemplate,
} from "../../domain/testFixtures.ts";
import { buildExportWorkbook } from "./exportWorkbook.ts";
import { parseWorkbook } from "./parseWorkbook.ts";

const MONTH = "2026-11";

const catalog: PlannerCatalog = {
  items: [
    makeItem({
      id: 1,
      code: "V01",
      templateId: 1,
      ourAccountId: 1,
      dueMonths: "3,9",
    }),
    makeItem({
      id: 2,
      code: "V02",
      name: "Pojistky",
      amount: null,
      amountFromInsurance: true,
      sortOrder: 2,
    }),
    makeItem({
      id: 3,
      code: "P01",
      direction: "income",
      category: "Já",
      amount: 50000,
      sortOrder: 3,
    }),
  ],
  templates: [makeTemplate({ counterpartyId: 1 })],
  counterparties: [makeCounterparty()],
  accounts: [makeAccount({ initialBalance: 1000 })],
  itemChanges: [
    {
      id: 1,
      itemId: 1,
      fromMonth: "2026-12",
      amount: 1250,
      dueDay: null,
      ourAccountId: 1,
      counterpartyAccount: null,
      vs: "77",
    },
  ],
  insuranceReserve: 1000,
};

function monthView(): MonthView {
  const rows = buildMonthRows(MONTH, indexCatalog(catalog), [
    makeEntry({ id: 1, itemId: 3, status: "paid", paidOn: "2026-11-10" }),
    makeEntry({ id: 2, itemId: 1, amount: 900, vs: "42", note: "jednou" }),
    makeEntry({
      id: 3,
      itemId: null,
      name: "Oprava kotle",
      direction: "expense",
      category: "1. Bydlení",
      amount: 3500,
      counterpartyId: 1,
      status: "processing",
    }),
  ]);
  return {
    month: MONTH,
    rows,
    summary: summarizeMonth(rows),
    accounts: breakdownByAccount(rows, catalog.accounts),
    correction: { amount: 0, note: null },
  };
}

const overview: Overview = {
  startDate: "2026-11-01",
  initialWealth: 1000,
  months: [],
  expenseMatrix: { direction: "expense", rows: [] },
  incomeMatrix: { direction: "income", rows: [] },
};

async function exportAndParse() {
  const workbook = buildExportWorkbook({
    settings: { startDate: "2026-11-01" },
    catalog,
    insurance: [{ id: 1, name: "Auto", annualAmount: 12000, note: null }],
    balances: [
      { accountId: 1, month: "2026-10", balance: 15000 },
      { accountId: 1, month: "2026-11", balance: 8000.5 },
    ],
    overview,
    monthViews: [monthView()],
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return parseWorkbook(buffer as ArrayBuffer);
}

describe("export → import", () => {
  it("zachová číselníky, položky i rezervu z pojistek", async () => {
    const data = await exportAndParse();
    expect(data.warnings).toEqual([]);
    expect(data.startDate).toBe("2026-11-01");
    expect(data.accounts[0]).toMatchObject({
      name: "Air – společný",
      initialBalance: 1000,
      kind: "operating",
      type: "Bankovní účet",
    });
    expect(data.templates[0]).toMatchObject({
      code: "E01",
      counterpartyName: "Dodavatel",
    });
    expect(data.insurance).toEqual([
      { name: "Auto", annualAmount: 12000, note: null },
    ]);
    expect(data.items.map((item) => item.code)).toEqual(["V01", "V02", "P01"]);
    expect(data.items[0]).toMatchObject({
      templateCode: "E01",
      ourAccountName: "Air – společný",
      dueMonths: "3,9",
    });
    expect(data.items[1]).toMatchObject({
      amountFromInsurance: true,
      amount: null,
    });
  });

  it("zachová změny položek od měsíce", async () => {
    const { itemChanges } = await exportAndParse();
    expect(itemChanges).toEqual([
      {
        itemCode: "V01",
        fromMonth: "2026-12",
        amount: 1250,
        dueDay: null,
        ourAccountName: "Air – společný",
        counterpartyAccount: null,
        vs: "77",
      },
    ]);
  });

  it("zachová měsíční zůstatky účtů bez součtového řádku", async () => {
    const { balances } = await exportAndParse();
    expect(balances).toEqual([
      { accountName: "Air – společný", month: "2026-10", balance: 15000 },
      { accountName: "Air – společný", month: "2026-11", balance: 8000.5 },
    ]);
  });

  it("zachová stavy, přepsání i jednorázové platby měsíce", async () => {
    const { entries } = await exportAndParse();
    expect(entries).toHaveLength(3);
    expect(entries.find((e) => e.itemCode === "P01")).toMatchObject({
      status: "paid",
      paidOn: "2026-11-10",
    });
    expect(entries.find((e) => e.itemCode === "V01")).toMatchObject({
      amount: 900,
      vs: "42",
      note: "jednou",
    });
    expect(entries.find((e) => e.itemCode == null)).toMatchObject({
      name: "Oprava kotle",
      direction: "expense",
      category: "1. Bydlení",
      amount: 3500,
      status: "processing",
      counterpartyName: "Dodavatel",
    });
  });
});

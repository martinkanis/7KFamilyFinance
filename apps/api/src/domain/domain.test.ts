import { describe, expect, it } from "bun:test";
import { defaultKindForType, normalizeAccountType } from "./accountTypes.ts";
import { actualWealthByMonth } from "./balances.ts";
import { addMonths, dueDateIn, monthRange } from "./month.ts";
import {
  breakdownByAccount,
  buildMonthRows,
  indexCatalog,
  insuranceReserveOf,
  type PlannerCatalog,
  summarizeMonth,
} from "./planner.ts";
import { isItemDueInMonth, parseDueMonths } from "./schedule.ts";
import {
  makeAccount,
  makeCounterparty,
  makeEntry,
  makeItem,
  makeTemplate,
} from "./testFixtures.ts";
import { computeWealth, overviewMonthRange } from "./wealth.ts";

function catalog(overrides: Partial<PlannerCatalog> = {}): PlannerCatalog {
  return {
    items: [makeItem()],
    templates: [],
    counterparties: [],
    accounts: [],
    insuranceReserve: 0,
    ...overrides,
  };
}

describe("měsíce", () => {
  it("přičítá měsíce přes konec roku", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2027-01", -1)).toBe("2026-12");
  });

  it("splatnost 31. v únoru posune na poslední den", () => {
    expect(dueDateIn("2027-02", 31)).toBe("2027-02-28");
  });

  it("vrací souvislý rozsah měsíců", () => {
    expect(monthRange("2026-11", "2027-01")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
    ]);
  });
});

describe("splatnost položky", () => {
  it("prázdné měsíce splatnosti = každý měsíc", () => {
    expect(parseDueMonths("")).toBeNull();
    expect(parseDueMonths(" 3; 9 ")).toEqual([3, 9]);
  });

  it("odmítne neplatné měsíce", () => {
    expect(() => parseDueMonths("3,13")).toThrow();
    expect(() => parseDueMonths("březen")).toThrow();
  });

  it("respektuje měsíce, platnost a aktivitu", () => {
    const quarterly = makeItem({ dueMonths: "3,9" });
    expect(isItemDueInMonth(quarterly, "2027-03")).toBe(true);
    expect(isItemDueInMonth(quarterly, "2027-04")).toBe(false);

    const limited = makeItem({
      validFrom: "2026-11-15",
      validTo: "2027-01-31",
    });
    expect(isItemDueInMonth(limited, "2026-10")).toBe(false);
    expect(isItemDueInMonth(limited, "2026-11")).toBe(true);
    expect(isItemDueInMonth(limited, "2027-02")).toBe(false);

    expect(isItemDueInMonth(makeItem({ active: false }), "2026-11")).toBe(
      false,
    );
  });
});

describe("řádky měsíce", () => {
  it("bere hodnoty v pořadí přepsání › položka › šablona › protistrana", () => {
    const index = indexCatalog(
      catalog({
        items: [makeItem({ amount: null, templateId: 1, counterpartyId: 1 })],
        templates: [makeTemplate()],
        counterparties: [makeCounterparty()],
      }),
    );

    const [fromTemplate] = buildMonthRows("2026-11", index, []);
    expect(fromTemplate?.amount).toBe(500);
    expect(fromTemplate?.counterpartyAccount).toBe("19-2000145399/0800");
    expect(fromTemplate?.vs).toBe("111");

    const [overridden] = buildMonthRows("2026-11", index, [
      makeEntry({ amount: 750, vs: "999", counterpartyAccount: "1/0800" }),
    ]);
    expect(overridden?.amount).toBe(750);
    expect(overridden?.vs).toBe("999");
    expect(overridden?.counterpartyAccount).toBe("1/0800");
    expect(overridden?.ks).toBe("0308");
  });

  it("nesplatná položka má v měsíci 0, přepsaná částka platí vždy", () => {
    const index = indexCatalog(
      catalog({ items: [makeItem({ dueMonths: "3" })] }),
    );
    expect(buildMonthRows("2026-11", index, [])[0]?.amount).toBe(0);
    expect(
      buildMonthRows("2026-11", index, [makeEntry({ amount: 200 })])[0]?.amount,
    ).toBe(200);
  });

  it("rezerva na pojistky je 1/12 ročních částek", () => {
    const reserve = insuranceReserveOf([12000, 6000]);
    const index = indexCatalog(
      catalog({
        items: [makeItem({ amount: null, amountFromInsurance: true })],
        insuranceReserve: reserve,
      }),
    );
    expect(buildMonthRows("2026-11", index, [])[0]?.amount).toBe(1500);
  });

  it("řadí výdaje před příjmy a jednorázové platby na konec kategorie", () => {
    const index = indexCatalog(
      catalog({
        items: [
          makeItem({
            id: 1,
            direction: "income",
            category: "Já",
            sortOrder: 1,
          }),
          makeItem({ id: 2, category: "1. Bydlení", sortOrder: 2 }),
        ],
      }),
    );
    const rows = buildMonthRows("2026-11", index, [
      makeEntry({
        id: 5,
        itemId: null,
        name: "Oprava",
        direction: "expense",
        category: "1. Bydlení",
        amount: 300,
      }),
    ]);
    expect(rows.map((row) => row.key)).toEqual(["item-2", "entry-5", "item-1"]);
  });
});

describe("souhrn měsíce", () => {
  it("počítá plán, hotovo, zbývá a změnu majetku včetně úspor", () => {
    const index = indexCatalog(
      catalog({
        items: [
          makeItem({ id: 1, amount: 1000 }),
          makeItem({ id: 2, amount: 400, savings: true, sortOrder: 2 }),
          makeItem({ id: 3, direction: "income", amount: 5000, sortOrder: 3 }),
        ],
        accounts: [makeAccount()],
      }),
    );
    const rows = buildMonthRows("2026-11", index, [
      makeEntry({ id: 1, itemId: 1, status: "paid", ourAccountId: 1 }),
      makeEntry({ id: 2, itemId: 2, status: "processing" }),
    ]);
    const summary = summarizeMonth(rows);

    expect(summary.expense).toEqual({
      plan: 1400,
      paid: 1000,
      processing: 400,
      remaining: 400,
    });
    expect(summary.balance).toBe(3600);
    expect(summary.savings).toBe(400);
    expect(summary.wealthChange).toBe(4000);

    const breakdown = breakdownByAccount(rows, index.catalog.accounts);
    expect(breakdown[0]).toMatchObject({
      accountId: 1,
      expensePlan: 1000,
      expenseRemaining: 0,
    });
    expect(breakdown[1]).toMatchObject({
      accountId: null,
      expensePlan: 400,
      incomeRemaining: 5000,
    });
  });
});

describe("majetek", () => {
  it("začíná počátečním stavem a řetězí konce měsíců", () => {
    const points = computeWealth(
      [
        { month: "2026-10", wealthChange: 100, correction: 0 },
        { month: "2026-11", wealthChange: 200, correction: 0 },
        { month: "2026-12", wealthChange: -50, correction: 10 },
      ],
      "2026-11-01",
      1000,
    );
    expect(points).toEqual([
      { wealthStart: null, wealthEnd: null },
      { wealthStart: 1000, wealthEnd: 1200 },
      { wealthStart: 1200, wealthEnd: 1160 },
    ]);
  });

  it("přehled pokrývá nejstarší záznam a 14 měsíců od počátku", () => {
    const months = overviewMonthRange({
      startDate: "2026-11-01",
      usedMonths: ["2026-10", "2027-01"],
      currentMonth: "2026-10",
    });
    expect(months[0]).toBe("2026-10");
    expect(months.at(-1)).toBe("2027-12");
    expect(months).toHaveLength(15);
  });
});

describe("skutečný stav účtů", () => {
  it("sečte zůstatky po měsících", () => {
    const totals = actualWealthByMonth([
      { accountId: 1, month: "2026-10", balance: 100.1 },
      { accountId: 2, month: "2026-10", balance: 200.2 },
      { accountId: 1, month: "2026-11", balance: 50 },
    ]);
    expect([...totals]).toEqual([
      ["2026-10", 300.3],
      ["2026-11", 50],
    ]);
  });
});

describe("typy účtů", () => {
  it("převede starší názvy typů a odvodí druh účtu", () => {
    expect(normalizeAccountType("Běžný účet")).toBe("Bankovní účet");
    expect(normalizeAccountType("Investice")).toBe("Investice");
    expect(defaultKindForType("Běžný účet")).toBe("operating");
    expect(defaultKindForType("Hotovost")).toBe("operating");
    expect(defaultKindForType("Stavební spoření")).toBe("savings");
    expect(defaultKindForType(null)).toBe("savings");
  });
});

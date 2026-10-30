import { describe, expect, it } from "bun:test";
import type { ItemChange } from "../contracts.ts";
import { suggestAccount } from "./accountMatch.ts";
import {
  assetGroupOf,
  defaultKindForType,
  normalizeAccountType,
} from "./accountTypes.ts";
import { actualWealthByMonth } from "./balances.ts";
import { changedValues, itemAsOf } from "./itemChanges.ts";
import { addMonths, dueDateIn, monthRange, nearestMonthKey } from "./month.ts";
import {
  breakdownByAccount,
  buildMonthRows,
  indexCatalog,
  insuranceReserveOf,
  type MonthEntryRecord,
  monthCategories,
  type PlannerCatalog,
  summarizeMonth,
} from "./planner.ts";
import {
  endingFrom,
  isItemDueInMonth,
  nextItemCode,
  parseDueMonths,
} from "./schedule.ts";
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
    itemChanges: [],
    categories: [],
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
  it("k číslu měsíce najde nejbližší rok, při shodě ten dřívější", () => {
    expect(nearestMonthKey(10, "2026-10")).toBe("2026-10");
    expect(nearestMonthKey(1, "2026-11")).toBe("2027-01");
    expect(nearestMonthKey(12, "2027-01")).toBe("2026-12");
    expect(nearestMonthKey(4, "2026-10")).toBe("2026-04");
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

describe("pořadí kategorií a plateb", () => {
  const items = [
    makeItem({ id: 1, code: "V01", category: "Bydlení", sortOrder: 1 }),
    makeItem({ id: 2, code: "V02", category: "Bydlení", sortOrder: 2 }),
    makeItem({ id: 3, code: "V03", category: "Auto", sortOrder: 3 }),
  ];
  const oneOff = (id: number, values: Partial<MonthEntryRecord>) =>
    makeEntry({
      id,
      itemId: null,
      name: `J${id}`,
      direction: "expense",
      category: "Bydlení",
      amount: 100,
      ...values,
    });

  it("uložené pořadí kategorií má přednost, prázdné kategorie se ukážou", () => {
    const index = indexCatalog(
      catalog({
        items,
        categories: [
          { direction: "expense", name: "Auto", sortOrder: 1 },
          { direction: "expense", name: "Prázdná", sortOrder: 2 },
        ],
      }),
    );
    const rows = buildMonthRows("2026-11", index, []);
    expect([...new Set(rows.map((r) => r.category))]).toEqual([
      "Auto",
      "Bydlení",
    ]);
    expect(monthCategories(index, rows).map((c) => c.name)).toEqual([
      "Auto",
      "Prázdná",
      "Bydlení",
    ]);
  });

  it("jednorázová platba stojí za položkou, za kterou ji přetáhli", () => {
    const index = indexCatalog(catalog({ items }));
    const rows = buildMonthRows("2026-11", index, [
      oneOff(10, {}),
      oneOff(11, { afterItemId: 1, sortOrder: 1 }),
      oneOff(12, { afterItemId: null, sortOrder: 0 }),
    ]);
    expect(rows.map((r) => r.name)).toEqual([
      "J12",
      "Nájem",
      "J11",
      "Nájem",
      "J10",
      "Nájem",
    ]);
  });
});

describe("změny položky od měsíce", () => {
  const change = (fromMonth: string, values: Partial<ItemChange>) => ({
    id: 0,
    itemId: 1,
    fromMonth,
    amount: null,
    dueDay: null,
    ourAccountId: null,
    counterpartyAccount: null,
    vs: null,
    ...values,
  });
  const item = makeItem({ id: 1, amount: 3200, dueDay: 15, vs: "111" });
  const changes = [
    change("2026-11", { amount: 3500 }),
    change("2027-02", { dueDay: 20, amount: 3600 }),
  ];

  it("minulé měsíce zůstanou, další se řídí změnou", () => {
    expect(itemAsOf(item, changes, "2026-10").amount).toBe(3200);
    expect(itemAsOf(item, changes, "2026-11").amount).toBe(3500);
    expect(itemAsOf(item, changes, "2027-01")).toMatchObject({
      amount: 3500,
      dueDay: 15,
    });
    expect(itemAsOf(item, changes, "2027-02")).toMatchObject({
      amount: 3600,
      dueDay: 20,
      vs: "111",
    });
  });

  it("změny jiné položky se nepoužijí", () => {
    const other = { ...change("2026-01", { amount: 1 }), itemId: 2 };
    expect(itemAsOf(item, [other], "2026-10").amount).toBe(3200);
  });

  it("řádek měsíce použije změnu, ruční úprava měsíce má přednost", () => {
    const index = indexCatalog(
      catalog({ items: [item], itemChanges: changes }),
    );
    expect(buildMonthRows("2026-10", index, [])[0]?.amount).toBe(3200);
    expect(buildMonthRows("2026-12", index, [])[0]?.amount).toBe(3500);
    const override = makeEntry({ itemId: 1, month: "2026-12", amount: 3300 });
    expect(buildMonthRows("2026-12", index, [override])[0]?.amount).toBe(3300);
  });

  it("najde změněné hodnoty", () => {
    expect(changedValues(item, { ...item, amount: 3500, vs: "111" })).toEqual({
      amount: 3500,
    });
  });
});

describe("ID nové položky", () => {
  it("navazuje na nejvyšší číslo ve směru", () => {
    expect(nextItemCode("expense", ["V01", "V57", "P03", "X9"])).toBe("V58");
    expect(nextItemCode("income", ["V01", "P03"])).toBe("P04");
    expect(nextItemCode("income", [])).toBe("P01");
  });
});

describe("ukončení položky od měsíce", () => {
  it("platí do konce předchozího měsíce", () => {
    expect(endingFrom({ validFrom: null, validTo: null }, "2026-10")).toEqual({
      kind: "end",
      validTo: "2026-09-30",
    });
    expect(
      endingFrom({ validFrom: "2025-01-01", validTo: null }, "2026-03"),
    ).toEqual({ kind: "end", validTo: "2026-02-28" });
  });

  it("dřívější konec platnosti nechá", () => {
    expect(
      endingFrom({ validFrom: null, validTo: "2026-05-31" }, "2026-10"),
    ).toEqual({ kind: "end", validTo: "2026-05-31" });
  });

  it("položku, která začíná až v tomto měsíci, smaže celou", () => {
    expect(
      endingFrom({ validFrom: "2026-10-15", validTo: null }, "2026-10"),
    ).toEqual({ kind: "delete" });
    expect(
      endingFrom({ validFrom: "2026-09-01", validTo: null }, "2026-10"),
    ).toEqual({ kind: "end", validTo: "2026-09-30" });
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

describe("skupiny majetku", () => {
  it("rozdělí typy účtů do přehledu", () => {
    expect(assetGroupOf("Bankovní účet")).toBe("bank");
    expect(assetGroupOf("Běžný účet")).toBe("bank");
    expect(assetGroupOf("Spořicí účet")).toBe("savings");
    expect(assetGroupOf("Penzijní spoření")).toBe("savings");
    expect(assetGroupOf("Stavební spoření")).toBe("building");
    expect(assetGroupOf("Kryptoměny")).toBe("investments");
    expect(assetGroupOf("ETF & akcie")).toBe("investments");
    expect(assetGroupOf("Hotovost")).toBe("other");
    expect(assetGroupOf(null)).toBe("other");
    expect(assetGroupOf("Zlato")).toBe("other");
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

describe("návrh účtu k popisku z Excelu", () => {
  const accounts = [
    { id: 1, name: "Portu" },
    { id: 2, name: "Air – Já (Jan)" },
    { id: 3, name: "Air Spoření – Já – Volné" },
    { id: 4, name: "Raiffka – stavební spoření" },
  ];

  it("nezáleží na pořadí slov, pomlčkách, diakritice ani zkratkách", () => {
    expect(suggestAccount("Air Já", accounts)).toBe(2);
    expect(suggestAccount("Air spoření - já - volne", accounts)).toBe(3);
    expect(suggestAccount("Raifka - stavebko", accounts)).toBe(4);
  });

  it("když se shoduje jen polovina slov, nic nenavrhne", () => {
    expect(suggestAccount("Petra Portu", accounts)).toBeNull();
    expect(suggestAccount("Hotovost", accounts)).toBeNull();
  });
});

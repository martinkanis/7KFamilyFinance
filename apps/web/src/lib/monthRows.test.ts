import { describe, expect, it } from "bun:test";
import type { MonthRow, MonthView } from "@kkff/api/contracts";
import {
  dueDateIn,
  groupByCategory,
  moveCategory,
  moveRow,
  rowWithChanges,
  sortRows,
  withCategoryRenamed,
} from "./monthRows.ts";

const row: MonthRow = {
  key: "item-1",
  itemId: 1,
  entryId: null,
  isOneOff: false,
  code: "V01",
  direction: "expense",
  category: "Bydlení",
  name: "Energie",
  counterparty: null,
  template: null,
  ourAccount: { id: 1, name: "Společný" },
  counterpartyAccount: "123/0800",
  vs: "111",
  ks: null,
  ss: null,
  message: null,
  dueDate: "2026-10-15",
  amount: 3200,
  isScheduled: true,
  status: "unpaid",
  paidOn: null,
  note: null,
  savings: false,
  overrides: {
    amount: null,
    dueDay: null,
    ourAccountId: null,
    counterpartyAccount: null,
    vs: null,
  },
};

describe("datum splatnosti", () => {
  it("den za koncem měsíce posune na poslední den", () => {
    expect(dueDateIn("2026-02", 31)).toBe("2026-02-28");
    expect(dueDateIn("2028-02", 30)).toBe("2028-02-29");
    expect(dueDateIn("2026-10", 5)).toBe("2026-10-05");
  });
});

describe("úprava řádku přímo v tabulce", () => {
  it("hned ukáže novou částku, splatnost i účet a zapíše je jako přepsání", () => {
    const next = rowWithChanges(
      row,
      "2026-10",
      { amount: 3500, dueDay: 20, ourAccountId: 2 },
      { id: 2, name: "Martin" },
    );
    expect(next.amount).toBe(3500);
    expect(next.dueDate).toBe("2026-10-20");
    expect(next.ourAccount).toEqual({ id: 2, name: "Martin" });
    expect(next.overrides).toMatchObject({
      amount: 3500,
      dueDay: 20,
      ourAccountId: 2,
    });
  });

  it("návrat k výchozí hodnotě nechá zobrazení na serveru", () => {
    const overridden = { ...row, overrides: { ...row.overrides, vs: "999" } };
    const next = rowWithChanges(overridden, "2026-10", { vs: null });
    expect(next.overrides.vs).toBeNull();
    expect(next.vs).toBe("111");
  });

  it("poznámku jde i smazat", () => {
    const next = rowWithChanges({ ...row, note: "x" }, "2026-10", {
      note: null,
    });
    expect(next.note).toBeNull();
  });
});

describe("přejmenování kategorie", () => {
  it("změní jen řádky dané kategorie a směru", () => {
    const income: MonthRow = { ...row, key: "item-2", direction: "income" };
    const view = { rows: [row, income] } as MonthView;
    const renamed = withCategoryRenamed(view, "expense", "Bydlení", "Domov");
    expect(renamed.rows.map((r) => r.category)).toEqual(["Domov", "Bydlení"]);
  });
});

const r = (
  key: string,
  category: string,
  values: Partial<MonthRow> = {},
): MonthRow => ({
  ...row,
  key,
  category,
  itemId: Number(key.slice(1)),
  ...values,
});

describe("skupiny a řazení v kategorii", () => {
  it("ukáže i prázdné kategorie v daném pořadí", () => {
    const groups = groupByCategory(
      [r("i1", "B"), r("i2", "A")],
      ["A", "Prázdná", "B"],
    );
    expect(groups.map((g) => [g.category, g.rows.length])).toEqual([
      ["A", 1],
      ["Prázdná", 0],
      ["B", 1],
    ]);
  });

  it("řadí podle splatnosti, částky i stavu, prázdná splatnost na konci", () => {
    const rows = [
      r("i1", "A", { dueDate: null, amount: 50, status: "paid" }),
      r("i2", "A", { dueDate: "2026-10-20", amount: 300, status: "unpaid" }),
      r("i3", "A", {
        dueDate: "2026-10-05",
        amount: 100,
        status: "processing",
      }),
    ];
    const keys = (sorted: MonthRow[]) => sorted.map((x) => x.key);
    expect(keys(sortRows(rows, { by: "due", desc: false }))).toEqual([
      "i3",
      "i2",
      "i1",
    ]);
    expect(keys(sortRows(rows, { by: "due", desc: true }))).toEqual([
      "i2",
      "i3",
      "i1",
    ]);
    expect(keys(sortRows(rows, { by: "amount", desc: true }))).toEqual([
      "i2",
      "i3",
      "i1",
    ]);
    expect(keys(sortRows(rows, { by: "status", desc: false }))).toEqual([
      "i2",
      "i3",
      "i1",
    ]);
    expect(keys(sortRows(rows, { by: "own", desc: false }))).toEqual([
      "i1",
      "i2",
      "i3",
    ]);
  });
});

describe("přetahování", () => {
  const rows = [
    r("i1", "A"),
    r("i2", "A"),
    r("i3", "B"),
    r("e9", "B", { isOneOff: true, itemId: null, entryId: 9 }),
  ];

  it("přesune platbu za jinou v rámci kategorie", () => {
    const result = moveRow(rows, "i1", {
      category: "A",
      anchorKey: "i2",
      after: true,
    });
    expect(result?.rows.map((x) => x.key)).toEqual(["i2", "i1", "i3", "e9"]);
    expect(result?.categoryRows).toEqual([
      { kind: "item", id: 2 },
      { kind: "item", id: 1 },
    ]);
  });

  it("přesune platbu do jiné kategorie, na začátek při puštění na záhlaví", () => {
    const result = moveRow(rows, "i1", {
      category: "B",
      anchorKey: null,
      after: false,
    });
    expect(result?.rows.map((x) => [x.key, x.category])).toEqual([
      ["i2", "A"],
      ["i1", "B"],
      ["i3", "B"],
      ["e9", "B"],
    ]);
    expect(result?.categoryRows).toEqual([
      { kind: "item", id: 1 },
      { kind: "item", id: 3 },
      { kind: "oneOff", id: 9 },
    ]);
  });

  it("přesune do prázdné kategorie", () => {
    const result = moveRow(rows, "e9", {
      category: "Nová",
      anchorKey: null,
      after: false,
    });
    expect(result?.rows.at(-1)).toMatchObject({ key: "e9", category: "Nová" });
    expect(result?.categoryRows).toEqual([{ kind: "oneOff", id: 9 }]);
  });

  it("přesune kategorii před i za jinou", () => {
    expect(moveCategory(["A", "B", "C"], "A", "C", true)).toEqual([
      "B",
      "C",
      "A",
    ]);
    expect(moveCategory(["A", "B", "C"], "C", "A", false)).toEqual([
      "C",
      "A",
      "B",
    ]);
    expect(moveCategory(["A", "B"], "A", "A", false)).toBeNull();
  });
});

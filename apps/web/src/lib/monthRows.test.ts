import { describe, expect, it } from "bun:test";
import type { MonthRow, MonthView } from "@kkff/api/contracts";
import { dueDateIn, rowWithChanges, withCategoryRenamed } from "./monthRows.ts";

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

import { describe, expect, it } from "bun:test";
import type { MonthRow } from "@kkff/api/contracts";
import { CATEGORICAL_COLORS, categoricalColor } from "./chartColors.ts";
import { categoryBreakdown, typeBreakdown } from "./monthBreakdown.ts";

const row = (
  category: string,
  amount: number,
  status: MonthRow["status"] = "unpaid",
  direction: MonthRow["direction"] = "expense",
): MonthRow =>
  ({
    key: `${category}-${amount}`,
    category,
    amount,
    status,
    direction,
  }) as MonthRow;

describe("rozpad měsíce podle kategorií", () => {
  it("sečte plán a zbývající částku a porovná s minulým měsícem", () => {
    const rows = [
      row("Bydlení", 18500, "paid"),
      row("Bydlení", 3200),
      row("Děti", 1200),
      row("Mzdy", 62000, "unpaid", "income"),
    ];
    const previous = [row("Bydlení", 20000), row("Auto", 900)];
    const result = categoryBreakdown(rows, "expense", previous);
    expect(
      result.map((s) => [s.label, s.value, s.remaining, s.change]),
    ).toEqual([
      ["Bydlení", 21700, 3200, 1700],
      ["Děti", 1200, 1200, 1200],
    ]);
    expect(result[0]?.color).toBe(CATEGORICAL_COLORS[0]);
  });

  it("bez minulého měsíce změnu neukáže", () => {
    const result = categoryBreakdown([row("Děti", 100)], "expense", null);
    expect(result[0]?.change).toBeNull();
  });

  it("nulovou kategorii vynechá, ale barvy ostatních nepřebarví", () => {
    const result = categoryBreakdown(
      [row("Bydlení", 0), row("Děti", 100)],
      "expense",
      null,
    );
    expect(result.map((s) => [s.label, s.color])).toEqual([
      ["Děti", CATEGORICAL_COLORS[1]],
    ]);
  });

  it("ukáže všechny kategorie, za osmou světlejší barvy", () => {
    const rows = Array.from({ length: 10 }, (_, i) => row(`K${i}`, 100));
    const result = categoryBreakdown(rows, "expense", null);
    expect(result).toHaveLength(10);
    expect(result[8]?.color).not.toBe(result[0]?.color);
    expect(result[8]?.color).toBe(categoricalColor(8));
  });

  it("rozdělí podle typu, bez typu šedě na konci", () => {
    const rows = [
      { ...row("A", 100), paymentType: { id: 2, name: "Nájmy" } },
      { ...row("B", 50), paymentType: { id: 2, name: "Nájmy" } },
      { ...row("C", 30), paymentType: null },
    ] as MonthRow[];
    const result = typeBreakdown(
      rows,
      "expense",
      [
        { id: 1, name: "Energie" },
        { id: 2, name: "Nájmy" },
      ],
      (r) => r.paymentType?.id ?? null,
      "Bez typu",
    );
    expect(result.map((s) => [s.label, s.value])).toEqual([
      ["Nájmy", 150],
      ["Bez typu", 30],
    ]);
    expect(result[0]?.color).toBe(categoricalColor(1));
  });
});

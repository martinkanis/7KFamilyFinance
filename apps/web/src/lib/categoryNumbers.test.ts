import { describe, expect, it } from "bun:test";
import {
  categoryNumber,
  numberedCategory,
  treeNumbers,
} from "./categoryNumbers.ts";

describe("číslování kategorií", () => {
  it("očísluje podle pořadí a nahradí staré číslo z názvu", () => {
    const categories = ["Bydlení", "2. Děti", "Auto"];
    expect(
      numberedCategory("Bydlení", categoryNumber(categories, "Bydlení")),
    ).toBe("1. Bydlení");
    expect(numberedCategory("2. Děti", 5)).toBe("5. Děti");
    expect(numberedCategory("1) Auto", 3)).toBe("3. Auto");
    expect(
      numberedCategory("Neznámá", categoryNumber(categories, "Neznámá")),
    ).toBe("Neznámá");
    expect(numberedCategory("2026", 1)).toBe("1. 2026");
  });
});

describe("číslování stromu kategorií", () => {
  it("podkategorie dostanou číslo nadřazené kategorie", () => {
    const numbers = treeNumbers([
      { name: "Bydlení", parent: null },
      { name: "Auto", parent: null },
      { name: "Energie", parent: "Bydlení" },
      { name: "Plyn", parent: "Energie" },
    ]);
    expect(numberedCategory("Plyn", numbers.get("Plyn") ?? null)).toBe(
      "1.1.1. Plyn",
    );
    expect(numbers.get("Auto")).toBe("2");
    expect(numberedCategory("1.2. Staré", "3")).toBe("3. Staré");
  });
});

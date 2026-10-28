import { describe, expect, it } from "bun:test";
import ExcelJS from "exceljs";
import { parseSavingsBlocks } from "./parseSavingsBlocks.ts";

function budgetSheet(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Rodinný rozpočet");
  sheet.getCell("B1").value = "říjen";
  sheet.getCell("C1").value = "říjen";
  // Sloučená hlavička: název je v obou buňkách, blok začíná jen tou levou.
  sheet.getCell("B3").value = "Stávající stav";
  sheet.getCell("C3").value = "Stávající stav";
  sheet.getCell("B5").value = "Hotovost";
  sheet.getCell("C5").value = 1000;
  sheet.getCell("B6").value = "Spořicí účet";
  sheet.getCell("C6").value = { formula: "500+700", result: 1200 };
  sheet.getCell("B7").value = "Bez částky";
  sheet.getCell("B8").value = "Celkem";
  sheet.getCell("C8").value = 2200;
  sheet.getCell("B9").value = "Pod součtem";
  sheet.getCell("C9").value = 5;
  sheet.getCell("E1").value = "Obvyklý měsíc";
  sheet.getCell("E3").value = "Stávající stav";
  sheet.getCell("E4").value = "Hotovost";
  sheet.getCell("F4").value = 1;
  return wb;
}

describe("bloky „Stávající stav“ z původního Excelu", () => {
  it("čte řádky do „Celkem“ a bloky bez názvu měsíce přeskočí", () => {
    expect(parseSavingsBlocks(budgetSheet())).toEqual([
      {
        title: "říjen",
        monthNumber: 10,
        rows: [
          { label: "Hotovost", balance: 1000 },
          { label: "Spořicí účet", balance: 1200 },
        ],
      },
    ]);
  });
});

import type ExcelJS from "exceljs";
import { numberOf, textOf } from "./cells.ts";

// Původní MonkeyBusiness.xlsx: každý měsíc má vlastní sloupce, v řádku 1 je
// jeho název („říjen“) a někde pod ním blok „Stávající stav“ – popisky
// v jednom sloupci, částky ve sloupci vpravo, na konci řádek „Celkem“.

const BLOCK_TITLE = "stávající stav";
const BLOCK_END = "celkem";
const MONTH_TITLE_ROW = 1;
const MAX_BLOCK_ROWS = 40;

const CZECH_MONTHS = [
  "leden",
  "únor",
  "březen",
  "duben",
  "květen",
  "červen",
  "červenec",
  "srpen",
  "září",
  "říjen",
  "listopad",
  "prosinec",
];

export interface SavingsBlock {
  title: string;
  /** 1–12 */
  monthNumber: number;
  rows: { label: string; balance: number }[];
}

function lowerText(cell: ExcelJS.Cell): string | null {
  return textOf(cell)?.toLowerCase() ?? null;
}

/** Sloučená hlavička vrací název i v buňce vpravo – blok začíná jen tou levou. */
function isBlockStart(sheet: ExcelJS.Worksheet, cell: ExcelJS.Cell): boolean {
  const column = Number(cell.col);
  const left =
    column > 1
      ? lowerText(sheet.getRow(Number(cell.row)).getCell(column - 1))
      : null;
  return lowerText(cell) === BLOCK_TITLE && left !== BLOCK_TITLE;
}

function blockRows(
  sheet: ExcelJS.Worksheet,
  titleRow: number,
  labelColumn: number,
): SavingsBlock["rows"] {
  const rows: SavingsBlock["rows"] = [];
  for (let r = titleRow + 1; r <= titleRow + MAX_BLOCK_ROWS; r++) {
    const row = sheet.getRow(r);
    const label = textOf(row.getCell(labelColumn));
    if (label?.toLowerCase().startsWith(BLOCK_END)) {
      break;
    }
    const balance = numberOf(row.getCell(labelColumn + 1));
    if (label != null && balance != null) {
      rows.push({ label, balance });
    }
  }
  return rows;
}

function blockAt(
  sheet: ExcelJS.Worksheet,
  cell: ExcelJS.Cell,
): SavingsBlock | null {
  const labelColumn = Number(cell.col);
  const title = textOf(sheet.getRow(MONTH_TITLE_ROW).getCell(labelColumn));
  const monthNumber = CZECH_MONTHS.indexOf(title?.toLowerCase() ?? "") + 1;
  // Bloky bez názvu měsíce jsou modelové scénáře („Obvyklý měsíc…“), ne skutečný stav.
  if (!title || monthNumber === 0) {
    return null;
  }
  const rows = blockRows(sheet, Number(cell.row), labelColumn);
  return rows.length === 0 ? null : { title, monthNumber, rows };
}

/** Všechny bloky „Stávající stav“ s názvem měsíce, po řádcích zleva doprava. */
export function parseSavingsBlocks(wb: ExcelJS.Workbook): SavingsBlock[] {
  const blocks: SavingsBlock[] = [];
  for (const sheet of wb.worksheets) {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const block = isBlockStart(sheet, cell) ? blockAt(sheet, cell) : null;
        if (block) {
          blocks.push(block);
        }
      });
    });
  }
  return blocks;
}

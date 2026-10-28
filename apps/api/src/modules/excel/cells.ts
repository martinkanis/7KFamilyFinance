import ExcelJS from "exceljs";
import { YES } from "./layout.ts";

type Scalar = string | number | boolean | Date | null;

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const CZECH_DATE = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

function scalarOfValue(value: ExcelJS.CellValue | undefined): Scalar {
  if (value == null) {
    return null;
  }
  if (value instanceof Date || typeof value !== "object") {
    return value;
  }
  if ("richText" in value) {
    return value.richText.map((part) => part.text).join("");
  }
  if ("hyperlink" in value) {
    return typeof value.text === "string" ? value.text : null;
  }
  if ("result" in value) {
    return scalarOfValue(value.result as ExcelJS.CellValue);
  }
  return null;
}

/** Hodnota buňky; u vzorce jeho uložený výsledek. */
export function scalarOf(cell: ExcelJS.Cell): Scalar {
  return scalarOfValue(cell.value);
}

export function formulaOf(cell: ExcelJS.Cell): string | null {
  return cell.type === ExcelJS.ValueType.Formula ? (cell.formula ?? "") : null;
}

function isoFromUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pad(value: string | undefined): string {
  return (value ?? "").padStart(2, "0");
}

export function dateOf(cell: ExcelJS.Cell): string | null {
  const value = scalarOf(cell);
  if (value instanceof Date) {
    return isoFromUtcDate(value);
  }
  if (typeof value === "number") {
    return isoFromUtcDate(new Date(EXCEL_EPOCH_UTC + value * MS_PER_DAY));
  }
  if (typeof value !== "string") {
    return null;
  }
  const czech = CZECH_DATE.exec(value.trim());
  if (czech) {
    return `${czech[3]}-${pad(czech[2])}-${pad(czech[1])}`;
  }
  const iso = ISO_DATE.exec(value.trim());
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

export function textOf(cell: ExcelJS.Cell): string | null {
  const value = scalarOf(cell);
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return isoFromUtcDate(value);
  }
  const text = String(value).trim();
  return text === "" ? null : text;
}

export function numberOf(cell: ExcelJS.Cell): number | null {
  const value = scalarOf(cell);
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const parsed = Number(value.replace(/[\s Kč]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function isYes(cell: ExcelJS.Cell): boolean {
  return textOf(cell)?.toLowerCase() === YES.toLowerCase();
}

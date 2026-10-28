import type ExcelJS from "exceljs";
import type { PaymentStatus } from "../../contracts.ts";

export const FONT = "Arial";
export const MONEY_FORMAT = '#,##0" Kč";[Red]-#,##0" Kč";"–"';
export const DATE_FORMAT = "d.m.yyyy";
export const MONTH_FORMAT = "mm/yyyy";

const HEADER_FILL = "1F3864";
const SECTION_FILL = "2F5496";
const CATEGORY_FILL = "D9E1F2";
const OVERRIDE_FILL = "FFF2CC";
const ZERO_FILL = "F2F2F2";

const STATUS_FILL: Record<PaymentStatus, string> = {
  paid: "92D050",
  processing: "FFD966",
  unpaid: "FF8F8F",
};

const ROW_TINT: Record<PaymentStatus, string> = {
  paid: "E2EFDA",
  processing: "FFF2CC",
  unpaid: "FCE4E4",
};

export function solidFill(color: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: `FF${color}` } };
}

export function writeTitle(
  sheet: ExcelJS.Worksheet,
  title: string,
  subtitle?: string,
): void {
  sheet.getCell("A1").value = title;
  sheet.getCell("A1").font = { name: FONT, size: 14, bold: true };
  if (subtitle) {
    sheet.getCell("A2").value = subtitle;
    sheet.getCell("A2").font = {
      name: FONT,
      italic: true,
      color: { argb: "FF595959" },
    };
  }
}

export function writeHeaderRow(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  headers: string[],
): void {
  const row = sheet.getRow(rowNumber);
  headers.forEach((header, index) => {
    const cell = row.getCell(index + 1);
    cell.value = header;
    if (header === "") {
      return;
    }
    cell.font = { name: FONT, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = solidFill(HEADER_FILL);
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}

export function writeSectionTitle(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  title: string,
  width: number,
): void {
  const row = sheet.getRow(rowNumber);
  row.getCell(2).value = title;
  for (let column = 1; column <= width; column++) {
    row.getCell(column).fill = solidFill(SECTION_FILL);
    row.getCell(column).font = {
      name: FONT,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
  }
}

export function styleCategoryRow(row: ExcelJS.Row, width: number): void {
  for (let column = 1; column <= width; column++) {
    row.getCell(column).fill = solidFill(CATEGORY_FILL);
    row.getCell(column).font = { name: FONT, bold: true };
  }
}

export function styleOverrideCells(row: ExcelJS.Row, columns: number[]): void {
  for (const column of columns) {
    row.getCell(column).fill = solidFill(OVERRIDE_FILL);
  }
}

/** Řádek platby: světlý podklad podle stavu, sytá barva u částky a stavu, šedá u nuly. */
export function stylePaymentRow(
  row: ExcelJS.Row,
  options: {
    status: PaymentStatus;
    isZero: boolean;
    width: number;
    strongColumns: number[];
  },
): void {
  for (let column = 1; column <= options.width; column++) {
    const cell = row.getCell(column);
    const isStrong = options.strongColumns.includes(column);
    if (options.isZero) {
      cell.fill = solidFill(ZERO_FILL);
      cell.font = { name: FONT, color: { argb: "FF808080" } };
      continue;
    }
    cell.fill = solidFill(
      isStrong ? STATUS_FILL[options.status] : ROW_TINT[options.status],
    );
    cell.font = { name: FONT, bold: isStrong };
  }
}

export function setColumnWidths(
  sheet: ExcelJS.Worksheet,
  widths: number[],
): void {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

export function utcDate(isoDate: string | null): Date | null {
  return isoDate ? new Date(`${isoDate}T00:00:00Z`) : null;
}

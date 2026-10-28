import type ExcelJS from "exceljs";
import type {
  Direction,
  DirectionSummary,
  MonthRow,
  MonthView,
} from "../../contracts.ts";
import { firstDayOf, monthNumber } from "../../domain/month.ts";
import {
  DATE_FORMAT,
  FONT,
  MONEY_FORMAT,
  setColumnWidths,
  styleCategoryRow,
  styleOverrideCells,
  stylePaymentRow,
  utcDate,
  writeHeaderRow,
  writeSectionTitle,
} from "./exportStyles.ts";
import {
  DIRECTION_LABELS,
  MONTH_COLUMNS,
  MONTH_FIRST_ROW,
  STATUS_LABELS,
  templateKey,
} from "./layout.ts";

const MONTH_NAMES = [
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

const MONTH_HEADERS = [
  "ID",
  "Položka",
  "Protistrana",
  "Šablona v bance",
  "Náš účet (z / na)",
  "Účet protistrany",
  "VS",
  "Splatnost",
  "Částka",
  "Stav",
  "Uhrazeno dne",
  "Poznámka",
  "",
  "Částka",
  "Den",
  "Náš účet",
  "Účet protistrany",
  "VS",
  "",
  "Směr",
  "Kategorie",
];

const VISIBLE_WIDTH = 12;
const C = MONTH_COLUMNS;
const OVERRIDE_COLUMNS = [
  C.overrideAmount,
  C.overrideDueDay,
  C.overrideOurAccount,
  C.overrideCounterpartyAccount,
  C.overrideVs,
];

export function monthTitle(month: string): string {
  return `${MONTH_NAMES[monthNumber(month) - 1]} ${month.slice(0, 4)}`;
}

type AccountNames = Map<number, string>;

function writeSummary(sheet: ExcelJS.Worksheet, view: MonthView): void {
  const header = sheet.getRow(2);
  ["Plán", "Hotovo", "Zpracovává se", "Zbývá"].forEach((label, i) => {
    header.getCell(3 + i).value = label;
    header.getCell(3 + i).font = { name: FONT, bold: true };
  });
  const lines: [number, string, DirectionSummary][] = [
    [3, "Příjmy", view.summary.income],
    [4, "Výdaje", view.summary.expense],
  ];
  for (const [rowNumber, label, summary] of lines) {
    const row = sheet.getRow(rowNumber);
    row.values = [
      null,
      label,
      summary.plan,
      summary.paid,
      summary.processing,
      summary.remaining,
    ];
    row.getCell(2).font = { name: FONT, bold: true };
  }
  sheet.getRow(5).values = [
    null,
    "Bilance (příjmy − výdaje)",
    view.summary.balance,
  ];
  sheet.getCell("H3").value = "Do úspor";
  sheet.getCell("I3").value = view.summary.savings;
  sheet.getCell("H4").value = "Změna majetku";
  sheet.getCell("I4").value = view.summary.wealthChange;
  for (const ref of [
    "C3",
    "D3",
    "E3",
    "F3",
    "C4",
    "D4",
    "E4",
    "F4",
    "C5",
    "I3",
    "I4",
  ]) {
    sheet.getCell(ref).numFmt = MONEY_FORMAT;
  }
}

function writePaymentRow(
  row: ExcelJS.Row,
  payment: MonthRow,
  accountNames: AccountNames,
): void {
  const overrides = payment.overrides;
  const values: [number, ExcelJS.CellValue][] = [
    [C.code, payment.code],
    [C.name, payment.name],
    [
      C.counterparty,
      payment.counterparty?.web
        ? {
            text: payment.counterparty.name,
            hyperlink: payment.counterparty.web,
          }
        : (payment.counterparty?.name ?? null),
    ],
    [
      C.template,
      payment.template
        ? templateKey(payment.template.code, payment.template.name)
        : null,
    ],
    [C.ourAccount, payment.ourAccount?.name ?? null],
    [C.counterpartyAccount, payment.counterpartyAccount],
    [C.vs, payment.vs],
    [C.dueDate, utcDate(payment.dueDate)],
    [C.amount, payment.amount],
    [C.status, payment.amount === 0 ? null : STATUS_LABELS[payment.status]],
    [C.paidOn, utcDate(payment.paidOn)],
    [C.note, payment.note],
    [C.overrideAmount, overrides.amount],
    [C.overrideDueDay, overrides.dueDay],
    [
      C.overrideOurAccount,
      overrides.ourAccountId == null
        ? null
        : (accountNames.get(overrides.ourAccountId) ?? null),
    ],
    [C.overrideCounterpartyAccount, overrides.counterpartyAccount],
    [C.overrideVs, overrides.vs],
    [C.direction, DIRECTION_LABELS[payment.direction]],
    [C.category, payment.category],
  ];
  for (const [column, value] of values) {
    row.getCell(column).value = value;
  }
  stylePaymentRow(row, {
    status: payment.status,
    isZero: payment.amount === 0,
    width: VISIBLE_WIDTH,
    strongColumns: [C.amount, C.status],
  });
  styleOverrideCells(row, OVERRIDE_COLUMNS);
  for (const column of [C.dueDate, C.paidOn]) {
    row.getCell(column).numFmt = DATE_FORMAT;
  }
  for (const column of [C.amount, C.overrideAmount]) {
    row.getCell(column).numFmt = MONEY_FORMAT;
  }
}

function writeCategoryRow(
  row: ExcelJS.Row,
  category: string,
  payments: MonthRow[],
): void {
  const plan = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = payments
    .filter((p) => p.status !== "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  row.getCell(C.name).value = category;
  row.getCell(C.amount).value = plan;
  row.getCell(C.amount).numFmt = MONEY_FORMAT;
  row.getCell(C.status).value =
    remaining === 0
      ? "hotovo ✓"
      : `zbývá ${remaining.toLocaleString("cs-CZ")} Kč`;
  styleCategoryRow(row, VISIBLE_WIDTH);
}

function groupByCategory(rows: MonthRow[]): Map<string, MonthRow[]> {
  const groups = new Map<string, MonthRow[]>();
  for (const row of rows) {
    groups.set(row.category, [...(groups.get(row.category) ?? []), row]);
  }
  return groups;
}

function writeSection(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  direction: Direction,
  view: MonthView,
  accountNames: AccountNames,
): number {
  const title =
    direction === "expense" ? "VÝDAJE" : "PŘÍJMY  (Zaplaceno = peníze přišly)";
  writeSectionTitle(sheet, startRow, title, VISIBLE_WIDTH);
  writeHeaderRow(sheet, startRow + 1, MONTH_HEADERS);
  let rowNumber = startRow + 2;
  const payments = view.rows.filter((row) => row.direction === direction);
  for (const [category, categoryRows] of groupByCategory(payments)) {
    writeCategoryRow(sheet.getRow(rowNumber++), category, categoryRows);
    for (const payment of categoryRows) {
      writePaymentRow(sheet.getRow(rowNumber++), payment, accountNames);
    }
  }
  return rowNumber;
}

function writeAccountTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  view: MonthView,
): void {
  writeSectionTitle(sheet, startRow, "ROZPIS PODLE NAŠICH ÚČTŮ", VISIBLE_WIDTH);
  writeHeaderRow(sheet, startRow + 1, [
    "",
    "Účet",
    "Odchází (plán)",
    "Ještě zaplatit",
    "Přichází (plán)",
    "Ještě nepřišlo",
    "Majitel",
  ]);
  view.accounts.forEach((account, index) => {
    const row = sheet.getRow(startRow + 2 + index);
    row.values = [
      null,
      account.name,
      account.expensePlan,
      account.expenseRemaining,
      account.incomePlan,
      account.incomeRemaining,
      account.owner,
    ];
    for (let column = 3; column <= 6; column++) {
      row.getCell(column).numFmt = MONEY_FORMAT;
    }
  });
}

export function writeMonthSheet(
  workbook: ExcelJS.Workbook,
  view: MonthView,
  accountNames: AccountNames,
): void {
  const sheet = workbook.addWorksheet(view.month, {
    views: [{ state: "frozen", xSplit: 2, ySplit: MONTH_FIRST_ROW - 1 }],
    properties: { tabColor: { argb: "FF70AD47" } },
  });
  sheet.getCell("B1").value = monthTitle(view.month);
  sheet.getCell("B1").font = { name: FONT, size: 16, bold: true };
  sheet.getCell("C1").value = utcDate(firstDayOf(view.month));
  sheet.getCell("C1").numFmt = DATE_FORMAT;
  writeSummary(sheet, view);
  const sectionStart = MONTH_FIRST_ROW - 2;
  const afterExpenses = writeSection(
    sheet,
    sectionStart,
    "expense",
    view,
    accountNames,
  );
  const afterIncomes = writeSection(
    sheet,
    afterExpenses + 1,
    "income",
    view,
    accountNames,
  );
  writeAccountTable(sheet, afterIncomes + 2, view);
  sheet.getRow(sectionStart).getCell(C.overrideAmount).value =
    "PŘEPSÁNO PRO TENTO MĚSÍC";
  setColumnWidths(
    sheet,
    [
      6, 36, 24, 32, 20, 21, 11, 12, 13, 15, 12, 34, 2, 12, 6, 19, 21, 11, 2, 8,
      30,
    ],
  );
  sheet.getColumn(C.direction).hidden = true;
  sheet.getColumn(C.category).hidden = true;
}

import ExcelJS from "exceljs";
import type {
  AccountBalance,
  CategoryMatrix,
  InsurancePolicy,
  MonthView,
  Overview,
  Settings,
} from "../../contracts.ts";
import { ACCOUNT_KIND_LABELS } from "../../domain/accountTypes.ts";
import { firstDayOf } from "../../domain/month.ts";
import type { PlannerCatalog } from "../../domain/planner.ts";
import { monthTitle, writeMonthSheet } from "./exportMonth.ts";
import {
  DATE_FORMAT,
  FONT,
  MONEY_FORMAT,
  MONTH_FORMAT,
  setColumnWidths,
  utcDate,
  writeHeaderRow,
  writeTitle,
} from "./exportStyles.ts";
import {
  BALANCE_TOTAL_LABEL,
  DIRECTION_LABELS,
  FIRST_INSURANCE_ROW,
  FIRST_TABLE_ROW,
  INSURANCE_HEADER_ROW,
  insuranceReserveFormula,
  NO,
  OVERVIEW_FIRST_ROW,
  OVERVIEW_HEADER_ROW,
  SHEETS,
  START_DATE_CELL,
  TABLE_HEADER_ROW,
  templateKey,
  YES,
} from "./layout.ts";

export interface ExportInput {
  settings: Settings;
  catalog: PlannerCatalog;
  insurance: InsurancePolicy[];
  balances: AccountBalance[];
  overview: Overview;
  monthViews: MonthView[];
}

const yesNo = (value: boolean) => (value ? YES : NO);
const yesOrBlank = (value: boolean) => (value ? YES : null);

function nameById<T extends { id: number; name: string }>(rows: T[]) {
  return new Map(rows.map((row) => [row.id, row.name]));
}

function writeRows(
  sheet: ExcelJS.Worksheet,
  firstRow: number,
  rows: ExcelJS.CellValue[][],
): void {
  rows.forEach((values, index) => {
    const row = sheet.getRow(firstRow + index);
    values.forEach((value, column) => {
      row.getCell(column + 1).value = value;
    });
  });
}

function formatColumns(
  sheet: ExcelJS.Worksheet,
  columns: number[],
  numFmt: string,
): void {
  for (const column of columns) {
    sheet.getColumn(column).numFmt = numFmt;
  }
}

function writeMatrix(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  title: string,
  matrix: CategoryMatrix,
  months: string[],
): number {
  sheet.getCell(startRow, 1).value = title;
  sheet.getCell(startRow, 1).font = { name: FONT, size: 12, bold: true };
  writeHeaderRow(sheet, startRow + 1, ["Kategorie", ...months, "Celkem"]);
  writeRows(
    sheet,
    startRow + 2,
    matrix.rows.map((row) => [row.category, ...row.amounts, row.total]),
  );
  for (let r = 0; r < matrix.rows.length; r++) {
    for (let column = 2; column <= months.length + 2; column++) {
      sheet.getCell(startRow + 2 + r, column).numFmt = MONEY_FORMAT;
    }
  }
  return startRow + 2 + matrix.rows.length;
}

function writeOverviewSheet(wb: ExcelJS.Workbook, overview: Overview): void {
  const sheet = wb.addWorksheet(SHEETS.overview, {
    views: [{ state: "frozen", xSplit: 1, ySplit: OVERVIEW_HEADER_ROW }],
    properties: { tabColor: { argb: "FFC00000" } },
  });
  writeTitle(sheet, "Přehled cashflow a majetku");
  sheet.getRow(2).values = [
    "Počáteční majetek:",
    null,
    overview.initialWealth,
    null,
    "k datu:",
    utcDate(overview.startDate),
  ];
  sheet.getCell("C2").numFmt = MONEY_FORMAT;
  sheet.getCell("F2").numFmt = DATE_FORMAT;
  writeHeaderRow(sheet, OVERVIEW_HEADER_ROW, [
    "Měsíc",
    "List",
    "Příjmy plán",
    "Příjmy přišlo",
    "Výdaje plán",
    "Výdaje zaplaceno",
    "Zbývá zaplatit",
    "Bilance (plán)",
    "Do úspor",
    "Korekce majetku",
    "Majetek na začátku",
    "Majetek na konci",
    "Zaplaceno %",
  ]);
  writeRows(
    sheet,
    OVERVIEW_FIRST_ROW,
    overview.months.map((m) => [
      utcDate(firstDayOf(m.month)),
      { text: m.month, hyperlink: `#'${m.month}'!A1` },
      m.incomePlan,
      m.incomePaid,
      m.expensePlan,
      m.expensePaid,
      m.expenseRemaining,
      m.balance,
      m.savings,
      m.correction,
      m.wealthStart,
      m.wealthEnd,
      m.paidRatio,
    ]),
  );
  const months = overview.months.map((m) => monthTitle(m.month));
  const lastMonthRow = OVERVIEW_FIRST_ROW + overview.months.length - 1;
  for (let r = OVERVIEW_FIRST_ROW; r <= lastMonthRow; r++) {
    sheet.getCell(r, 1).numFmt = MONTH_FORMAT;
    for (let column = 3; column <= 12; column++) {
      sheet.getCell(r, column).numFmt = MONEY_FORMAT;
    }
    sheet.getCell(r, 13).numFmt = "0%";
  }
  const totalRow = sheet.getRow(lastMonthRow + 1);
  totalRow.getCell(1).value = "Celkem za období";
  totalRow.font = { name: FONT, bold: true };
  for (let column = 3; column <= 10; column++) {
    const letter = sheet.getColumn(column).letter;
    totalRow.getCell(column).value = {
      formula: `SUM(${letter}${OVERVIEW_FIRST_ROW}:${letter}${lastMonthRow})`,
    };
    totalRow.getCell(column).numFmt = MONEY_FORMAT;
  }
  const afterExpenses = writeMatrix(
    sheet,
    lastMonthRow + 4,
    "Výdaje podle kategorií (plán)",
    overview.expenseMatrix,
    months,
  );
  writeMatrix(
    sheet,
    afterExpenses + 2,
    "Příjmy podle skupin (plán)",
    overview.incomeMatrix,
    months,
  );
  setColumnWidths(sheet, [34, 10, ...Array(15).fill(14)]);
}

function writeItemsSheet(
  wb: ExcelJS.Workbook,
  input: ExportInput,
  reserveRow: number,
): void {
  const sheet = wb.addWorksheet(SHEETS.items, {
    views: [{ state: "frozen", xSplit: 4, ySplit: TABLE_HEADER_ROW }],
  });
  const { catalog } = input;
  const accounts = nameById(catalog.accounts);
  const counterparties = nameById(catalog.counterparties);
  const templates = new Map(
    catalog.templates.map((t) => [t.id, templateKey(t.code, t.name)]),
  );
  writeTitle(
    sheet,
    "Položky – pravidelné platby a příjmy",
    "Prázdná částka = ze šablony. Měsíce splatnosti prázdné = každý měsíc.",
  );
  writeHeaderRow(sheet, TABLE_HEADER_ROW, [
    "ID",
    "Směr",
    "Kategorie",
    "Položka",
    "Částka",
    "Den splatnosti",
    "Měsíce splatnosti",
    "Platí od",
    "Platí do",
    "Náš účet (z / na)",
    "Protistrana",
    "Šablona",
    "Účet protistrany",
    "VS",
    "KS",
    "SS",
    "Zpráva pro příjemce",
    "Do úspor",
    "Aktivní",
    "Poznámka",
  ]);
  writeRows(
    sheet,
    FIRST_TABLE_ROW,
    catalog.items.map((item) => [
      item.code,
      DIRECTION_LABELS[item.direction],
      item.category,
      item.name,
      item.amountFromInsurance
        ? {
            formula: insuranceReserveFormula(reserveRow),
            result: catalog.insuranceReserve,
          }
        : item.amount,
      item.dueDay,
      item.dueMonths,
      utcDate(item.validFrom),
      utcDate(item.validTo),
      item.ourAccountId == null
        ? null
        : (accounts.get(item.ourAccountId) ?? null),
      item.counterpartyId == null
        ? null
        : (counterparties.get(item.counterpartyId) ?? null),
      item.templateId == null ? null : (templates.get(item.templateId) ?? null),
      item.counterpartyAccount,
      item.vs,
      item.ks,
      item.ss,
      item.message,
      yesOrBlank(item.savings),
      yesNo(item.active),
      item.note,
    ]),
  );
  formatColumns(sheet, [5], MONEY_FORMAT);
  formatColumns(sheet, [8, 9], DATE_FORMAT);
  setColumnWidths(
    sheet,
    [6, 8, 30, 34, 13, 9, 12, 11, 11, 22, 26, 34, 21, 11, 7, 7, 20, 9, 8, 50],
  );
}

function writeAccountsSheet(wb: ExcelJS.Workbook, input: ExportInput): void {
  const sheet = wb.addWorksheet(SHEETS.accounts);
  writeTitle(sheet, "Naše účty a spořicí instrumenty");
  sheet.getCell("A2").value = "Počáteční stav k:";
  sheet.getCell(START_DATE_CELL).value = utcDate(input.settings.startDate);
  sheet.getCell(START_DATE_CELL).numFmt = DATE_FORMAT;
  sheet.getCell("E2").value = "Majetek celkem:";
  sheet.getCell("G2").value = input.overview.initialWealth;
  sheet.getCell("G2").numFmt = MONEY_FORMAT;
  writeHeaderRow(sheet, TABLE_HEADER_ROW, [
    "Název",
    "Instituce",
    "Majitel",
    "Typ",
    "Číslo účtu",
    "Měna",
    "Počáteční stav (Kč)",
    "Poznámka",
    "Druh",
  ]);
  writeRows(
    sheet,
    FIRST_TABLE_ROW,
    input.catalog.accounts.map((a) => [
      a.name,
      a.institution,
      a.owner,
      a.type,
      a.number,
      a.currency,
      a.initialBalance,
      a.note,
      ACCOUNT_KIND_LABELS[a.kind],
    ]),
  );
  for (
    let r = FIRST_TABLE_ROW;
    r < FIRST_TABLE_ROW + input.catalog.accounts.length;
    r++
  ) {
    sheet.getCell(r, 7).numFmt = MONEY_FORMAT;
  }
  setColumnWidths(sheet, [34, 26, 11, 17, 22, 7, 17, 60]);
}

function writeTemplatesSheet(wb: ExcelJS.Workbook, input: ExportInput): void {
  const sheet = wb.addWorksheet(SHEETS.templates);
  const counterparties = nameById(input.catalog.counterparties);
  writeTitle(sheet, "Šablony plateb (zrcadlo šablon v bance)");
  writeHeaderRow(sheet, TABLE_HEADER_ROW, [
    "Klíč",
    "ID",
    "Název šablony v bance",
    "Přihlášení",
    "Protistrana",
    "Účet příjemce",
    "VS",
    "KS",
    "SS",
    "Zpráva pro příjemce",
    "Částka",
    "Použito ×",
    "Známý účet ✓",
    "Ověřeno",
    "Poznámka",
  ]);
  writeRows(
    sheet,
    FIRST_TABLE_ROW,
    input.catalog.templates.map((t) => [
      templateKey(t.code, t.name),
      t.code,
      t.name,
      t.bankLogin,
      t.counterpartyId == null
        ? null
        : (counterparties.get(t.counterpartyId) ?? null),
      t.accountNumber,
      t.vs,
      t.ks,
      t.ss,
      t.message,
      t.amount,
      t.timesUsed,
      yesOrBlank(t.knownAccount),
      yesOrBlank(t.verified),
      t.note,
    ]),
  );
  setColumnWidths(
    sheet,
    [40, 6, 34, 17, 26, 23, 11, 7, 7, 22, 12, 9, 8, 9, 30],
  );
}

function writeCounterpartiesSheet(
  wb: ExcelJS.Workbook,
  input: ExportInput,
): void {
  const sheet = wb.addWorksheet(SHEETS.counterparties);
  writeTitle(sheet, "Protistrany – firmy, lidé, dodavatelé");
  writeHeaderRow(sheet, TABLE_HEADER_ROW, [
    "Název",
    "Typ",
    "Hlavní číslo účtu",
    "Web / odkaz",
    "Kontakt",
    "Poznámka",
  ]);
  writeRows(
    sheet,
    FIRST_TABLE_ROW,
    input.catalog.counterparties.map((c) => [
      c.name,
      c.type,
      c.accountNumber,
      c.web ? { text: c.web, hyperlink: c.web } : null,
      c.contact,
      c.note,
    ]),
  );
  setColumnWidths(sheet, [34, 18, 24, 32, 22, 60]);
}

/** Řádek s měsíční rezervou, na který odkazují položky „z pojistek“. */
function insuranceReserveRow(policyCount: number): number {
  return FIRST_INSURANCE_ROW + policyCount + 1;
}

function writeInsuranceSheet(wb: ExcelJS.Workbook, input: ExportInput): void {
  const sheet = wb.addWorksheet(SHEETS.insurance);
  writeTitle(sheet, "Roční pojistky → měsíční rezerva");
  writeHeaderRow(sheet, INSURANCE_HEADER_ROW, [
    "Pojistka",
    "Roční částka",
    "Poznámka",
  ]);
  writeRows(
    sheet,
    FIRST_INSURANCE_ROW,
    input.insurance.map((p) => [p.name, p.annualAmount, p.note]),
  );
  const reserveRow = insuranceReserveRow(input.insurance.length);
  const totalRow = reserveRow - 1;
  const lastPolicyRow = totalRow - 1;
  const total = input.insurance.reduce((sum, p) => sum + p.annualAmount, 0);
  sheet.getRow(totalRow).values = [
    "Celkem za rok",
    {
      formula: `SUM(B${FIRST_INSURANCE_ROW}:B${Math.max(lastPolicyRow, FIRST_INSURANCE_ROW)})`,
      result: total,
    },
  ];
  sheet.getRow(reserveRow).values = [
    "Měsíční rezerva (1/12)",
    { formula: `B${totalRow}/12`, result: input.catalog.insuranceReserve },
  ];
  sheet.getColumn(2).numFmt = MONEY_FORMAT;
  setColumnWidths(sheet, [34, 15, 50]);
}

/** Účty × měsíce se skutečnými zůstatky; jde zpět importovat. */
function writeBalancesSheet(wb: ExcelJS.Workbook, input: ExportInput): void {
  const sheet = wb.addWorksheet(SHEETS.balances, {
    views: [{ state: "frozen", xSplit: 1, ySplit: TABLE_HEADER_ROW }],
  });
  writeTitle(
    sheet,
    "Stav účtů a spoření",
    "Skutečné zůstatky zapsané při měsíční kontrole.",
  );
  const months = [...new Set(input.balances.map((b) => b.month))].sort();
  const balanceOf = new Map(
    input.balances.map((b) => [`${b.accountId}|${b.month}`, b.balance]),
  );
  writeHeaderRow(sheet, TABLE_HEADER_ROW, ["Účet", ...months]);
  const accounts = input.catalog.accounts;
  writeRows(
    sheet,
    FIRST_TABLE_ROW,
    accounts.map((account) => [
      account.name,
      ...months.map((month) => balanceOf.get(`${account.id}|${month}`) ?? null),
    ]),
  );
  const totalRow = sheet.getRow(FIRST_TABLE_ROW + accounts.length);
  totalRow.getCell(1).value = BALANCE_TOTAL_LABEL;
  totalRow.font = { name: FONT, bold: true };
  months.forEach((month, index) => {
    totalRow.getCell(index + 2).value = input.balances
      .filter((b) => b.month === month)
      .reduce((sum, b) => sum + b.balance, 0);
  });
  formatColumns(
    sheet,
    months.map((_, index) => index + 2),
    MONEY_FORMAT,
  );
  setColumnWidths(sheet, [34, ...months.map(() => 14)]);
}

export function buildExportWorkbook(input: ExportInput): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "7KFamilyFinance";
  wb.created = new Date();
  writeOverviewSheet(wb, input.overview);
  const accountNames = nameById(input.catalog.accounts);
  for (const view of input.monthViews) {
    writeMonthSheet(wb, view, accountNames);
  }
  writeItemsSheet(wb, input, insuranceReserveRow(input.insurance.length));
  writeAccountsSheet(wb, input);
  writeBalancesSheet(wb, input);
  writeTemplatesSheet(wb, input);
  writeCounterpartiesSheet(wb, input);
  writeInsuranceSheet(wb, input);
  return wb;
}

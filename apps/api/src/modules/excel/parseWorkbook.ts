import ExcelJS from "exceljs";
import type {
  AccountInput,
  AccountKind,
  CounterpartyInput,
  Direction,
  InsurancePolicyInput,
  ItemInput,
  PaymentStatus,
  TemplateInput,
} from "../../contracts.ts";
import {
  ACCOUNT_KIND_LABELS,
  defaultKindForType,
  normalizeAccountType,
} from "../../domain/accountTypes.ts";
import { monthKeyOfDate } from "../../domain/month.ts";
import { parseDueMonths } from "../../domain/schedule.ts";
import { dateOf, formulaOf, isYes, numberOf, textOf } from "./cells.ts";
import {
  ACCOUNT_COLUMNS,
  BALANCE_TOTAL_LABEL,
  COUNTERPARTY_COLUMNS,
  DIRECTION_LABELS,
  FIRST_INSURANCE_ROW,
  FIRST_TABLE_ROW,
  INSURANCE_COLUMNS,
  ITEM_COLUMNS,
  isInsuranceReserveFormula,
  MONTH_COLUMNS,
  MONTH_FIRST_ROW,
  MONTH_SHEET_PATTERN,
  NO,
  OVERVIEW_COLUMNS,
  OVERVIEW_FIRST_ROW,
  SHEETS,
  START_DATE_CELL,
  STATUS_LABELS,
  TABLE_HEADER_ROW,
  TEMPLATE_COLUMNS,
  templateCodeFromKey,
} from "./layout.ts";

export type ImportedTemplate = Omit<TemplateInput, "counterpartyId"> & {
  counterpartyName: string | null;
};

export type ImportedItem = Omit<
  ItemInput,
  "ourAccountId" | "counterpartyId" | "templateId"
> & {
  ourAccountName: string | null;
  counterpartyName: string | null;
  templateCode: string | null;
};

export interface ImportedEntry {
  month: string;
  itemCode: string | null;
  status: PaymentStatus;
  paidOn: string | null;
  note: string | null;
  amount: number | null;
  dueDay: number | null;
  ourAccountName: string | null;
  counterpartyAccount: string | null;
  vs: string | null;
  name: string | null;
  direction: Direction | null;
  category: string | null;
  counterpartyName: string | null;
}

export interface ImportedBalance {
  accountName: string;
  month: string;
  balance: number;
}

export interface ImportData {
  startDate: string | null;
  accounts: AccountInput[];
  counterparties: CounterpartyInput[];
  templates: ImportedTemplate[];
  insurance: InsurancePolicyInput[];
  items: ImportedItem[];
  entries: ImportedEntry[];
  corrections: { month: string; amount: number }[];
  balances: ImportedBalance[];
  warnings: string[];
}

export class WorkbookFormatError extends Error {}

const UNCATEGORIZED = "Nezařazeno";
const INSURANCE_SUMMARY_PREFIXES = ["celkem", "měsíční rezerva"];

type RowReader = (column: number) => ExcelJS.Cell;

function rowsWithKey(
  sheet: ExcelJS.Worksheet | undefined,
  firstRow: number,
  keyColumn: number,
): RowReader[] {
  const readers: RowReader[] = [];
  for (let r = firstRow; sheet && r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (textOf(row.getCell(keyColumn)) != null) {
      readers.push((column) => row.getCell(column));
    }
  }
  return readers;
}

function reverseLabel<T extends string>(
  labels: Record<T, string>,
  text: string | null,
): T | null {
  const entry = Object.entries(labels).find(([, label]) => label === text);
  return (entry?.[0] as T | undefined) ?? null;
}

function webUrl(text: string | null): string | null {
  if (!text) {
    return null;
  }
  const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  return URL.canParse(url) ? url : null;
}

function uniqueBy<T>(
  rows: T[],
  keyOf: (row: T) => string,
  what: string,
  warnings: string[],
): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = keyOf(row);
    if (seen.has(key)) {
      warnings.push(`${what} „${key}“ je v souboru dvakrát, beru jen první`);
      return false;
    }
    seen.add(key);
    return true;
  });
}

/** Druh účtu ze sloupce „Druh“; starší sešity ho nemají (nebo mají Ano/Ne) – pak podle typu. */
function accountKindOf(cell: ExcelJS.Cell, type: string | null): AccountKind {
  const label = reverseLabel(ACCOUNT_KIND_LABELS, textOf(cell));
  if (label) {
    return label;
  }
  if (textOf(cell) != null) {
    return isYes(cell) ? "operating" : "savings";
  }
  return defaultKindForType(type);
}

function parseAccounts(wb: ExcelJS.Workbook): AccountInput[] {
  const sheet = wb.getWorksheet(SHEETS.accounts);
  const c = ACCOUNT_COLUMNS;
  return rowsWithKey(sheet, FIRST_TABLE_ROW, c.name).map((cell, index) => ({
    name: textOf(cell(c.name)) ?? "",
    institution: textOf(cell(c.institution)),
    owner: textOf(cell(c.owner)),
    type: normalizeAccountType(textOf(cell(c.type))),
    number: textOf(cell(c.number)),
    kind: accountKindOf(cell(c.kind), textOf(cell(c.type))),
    currency: textOf(cell(c.currency))?.toUpperCase() ?? "CZK",
    initialBalance: numberOf(cell(c.initialBalance)) ?? 0,
    note: textOf(cell(c.note)),
    sortOrder: index + 1,
  }));
}

function parseCounterparties(wb: ExcelJS.Workbook): CounterpartyInput[] {
  const sheet = wb.getWorksheet(SHEETS.counterparties);
  const c = COUNTERPARTY_COLUMNS;
  return rowsWithKey(sheet, FIRST_TABLE_ROW, c.name).map((cell) => ({
    name: textOf(cell(c.name)) ?? "",
    type: textOf(cell(c.type)),
    accountNumber: textOf(cell(c.accountNumber)),
    web: webUrl(textOf(cell(c.web))),
    contact: textOf(cell(c.contact)),
    note: textOf(cell(c.note)),
  }));
}

function parseTemplates(wb: ExcelJS.Workbook): ImportedTemplate[] {
  const sheet = wb.getWorksheet(SHEETS.templates);
  const c = TEMPLATE_COLUMNS;
  return rowsWithKey(sheet, FIRST_TABLE_ROW, c.code).map((cell) => ({
    code: textOf(cell(c.code)) ?? "",
    name: textOf(cell(c.name)) ?? textOf(cell(c.code)) ?? "",
    bankLogin: textOf(cell(c.bankLogin)),
    counterpartyName: textOf(cell(c.counterparty)),
    accountNumber: textOf(cell(c.accountNumber)),
    vs: textOf(cell(c.vs)),
    ks: textOf(cell(c.ks)),
    ss: textOf(cell(c.ss)),
    message: textOf(cell(c.message)),
    amount: numberOf(cell(c.amount)),
    timesUsed: numberOf(cell(c.timesUsed)),
    knownAccount: isYes(cell(c.knownAccount)),
    verified: isYes(cell(c.verified)),
    note: textOf(cell(c.note)),
  }));
}

function isInsuranceSummaryRow(name: string): boolean {
  const lower = name.toLowerCase();
  return INSURANCE_SUMMARY_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function parseInsurance(wb: ExcelJS.Workbook): InsurancePolicyInput[] {
  const sheet = wb.getWorksheet(SHEETS.insurance);
  const c = INSURANCE_COLUMNS;
  return rowsWithKey(sheet, FIRST_INSURANCE_ROW, c.name)
    .map((cell) => ({
      name: textOf(cell(c.name)) ?? "",
      annualAmount: numberOf(cell(c.annualAmount)) ?? 0,
      note: textOf(cell(c.note)),
    }))
    .filter((policy) => !isInsuranceSummaryRow(policy.name));
}

function itemDueMonths(
  text: string | null,
  code: string,
  warnings: string[],
): string | null {
  try {
    return parseDueMonths(text)?.join(",") ?? null;
  } catch {
    warnings.push(
      `Položka ${code}: měsíce splatnosti „${text}“ nerozumím, nechávám prázdné`,
    );
    return null;
  }
}

function itemDueDay(
  cell: ExcelJS.Cell,
  code: string,
  warnings: string[],
): number | null {
  const day = numberOf(cell);
  if (day == null) {
    return null;
  }
  if (Number.isInteger(day) && day >= 1 && day <= 31) {
    return day;
  }
  warnings.push(
    `Položka ${code}: den splatnosti „${day}“ není 1–31, nechávám prázdné`,
  );
  return null;
}

function parseItem(
  cell: RowReader,
  index: number,
  warnings: string[],
): ImportedItem | null {
  const c = ITEM_COLUMNS;
  const code = textOf(cell(c.code)) ?? "";
  const direction = reverseLabel(DIRECTION_LABELS, textOf(cell(c.direction)));
  const name = textOf(cell(c.name));
  if (!direction || !name) {
    warnings.push(
      `Položka ${code}: chybí směr (Výdaj/Příjem) nebo název, přeskakuji`,
    );
    return null;
  }
  const amountFormula = formulaOf(cell(c.amount));
  const amountFromInsurance =
    amountFormula != null && isInsuranceReserveFormula(amountFormula);
  const templateKey = textOf(cell(c.template));
  return {
    code,
    direction,
    category: textOf(cell(c.category)) ?? UNCATEGORIZED,
    name,
    amount: amountFromInsurance ? null : numberOf(cell(c.amount)),
    amountFromInsurance,
    dueDay: itemDueDay(cell(c.dueDay), code, warnings),
    dueMonths: itemDueMonths(textOf(cell(c.dueMonths)), code, warnings),
    validFrom: dateOf(cell(c.validFrom)),
    validTo: dateOf(cell(c.validTo)),
    ourAccountName: textOf(cell(c.ourAccount)),
    counterpartyName: textOf(cell(c.counterparty)),
    templateCode: templateKey ? templateCodeFromKey(templateKey) : null,
    counterpartyAccount: textOf(cell(c.counterpartyAccount)),
    vs: textOf(cell(c.vs)),
    ks: textOf(cell(c.ks)),
    ss: textOf(cell(c.ss)),
    message: textOf(cell(c.message)),
    savings: isYes(cell(c.savings)),
    active: textOf(cell(c.active)) !== NO,
    note: textOf(cell(c.note)),
    sortOrder: index + 1,
  };
}

function parseItems(wb: ExcelJS.Workbook, warnings: string[]): ImportedItem[] {
  const sheet = wb.getWorksheet(SHEETS.items);
  return rowsWithKey(sheet, FIRST_TABLE_ROW, ITEM_COLUMNS.code)
    .map((cell, index) => parseItem(cell, index, warnings))
    .filter((item): item is ImportedItem => item !== null);
}

function hasEntryData(entry: ImportedEntry): boolean {
  return (
    entry.status !== "unpaid" ||
    entry.itemCode == null ||
    [
      entry.paidOn,
      entry.note,
      entry.amount,
      entry.dueDay,
      entry.ourAccountName,
      entry.counterpartyAccount,
      entry.vs,
    ].some((value) => value != null)
  );
}

function parseMonthRow(month: string, row: ExcelJS.Row): ImportedEntry | null {
  const c = MONTH_COLUMNS;
  const cell = (column: number) => row.getCell(column);
  const direction = reverseLabel(DIRECTION_LABELS, textOf(cell(c.direction)));
  const itemCode = textOf(cell(c.code));
  // Řádek bez ID je jednorázová platba jen tehdy, když název někdo napsal (není to vzorec).
  const literalText = (column: number) =>
    formulaOf(cell(column)) == null ? textOf(cell(column)) : null;
  const oneOffName = literalText(c.name);
  if (!direction || (!itemCode && !oneOffName)) {
    return null;
  }
  const entry: ImportedEntry = {
    month,
    itemCode,
    status: reverseLabel(STATUS_LABELS, textOf(cell(c.status))) ?? "unpaid",
    paidOn: dateOf(cell(c.paidOn)),
    note: textOf(cell(c.note)),
    amount: numberOf(cell(c.overrideAmount)),
    dueDay: numberOf(cell(c.overrideDueDay)),
    ourAccountName: textOf(cell(c.overrideOurAccount)),
    counterpartyAccount: textOf(cell(c.overrideCounterpartyAccount)),
    vs: textOf(cell(c.overrideVs)),
    name: itemCode ? null : oneOffName,
    direction: itemCode ? null : direction,
    category: itemCode ? null : (textOf(cell(c.category)) ?? UNCATEGORIZED),
    counterpartyName: itemCode ? null : literalText(c.counterparty),
  };
  return hasEntryData(entry) ? entry : null;
}

function parseMonthSheets(wb: ExcelJS.Workbook): ImportedEntry[] {
  return wb.worksheets
    .filter((sheet) => MONTH_SHEET_PATTERN.test(sheet.name))
    .flatMap((sheet) => {
      const entries: ImportedEntry[] = [];
      for (let r = MONTH_FIRST_ROW; r <= sheet.rowCount; r++) {
        const entry = parseMonthRow(sheet.name, sheet.getRow(r));
        if (entry) {
          entries.push(entry);
        }
      }
      return entries;
    });
}

function parseCorrections(wb: ExcelJS.Workbook) {
  const sheet = wb.getWorksheet(SHEETS.overview);
  const corrections: { month: string; amount: number }[] = [];
  for (let r = OVERVIEW_FIRST_ROW; sheet && r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const date = dateOf(row.getCell(OVERVIEW_COLUMNS.month));
    if (!date) {
      break;
    }
    const amount = numberOf(row.getCell(OVERVIEW_COLUMNS.correction));
    if (amount) {
      corrections.push({ month: monthKeyOfDate(date), amount });
    }
  }
  return corrections;
}

function balanceMonthOf(cell: ExcelJS.Cell): string | null {
  const text = textOf(cell);
  if (text && MONTH_SHEET_PATTERN.test(text)) {
    return text;
  }
  const date = dateOf(cell);
  return date ? monthKeyOfDate(date) : null;
}

/** List „Stav účtů“: účty v řádcích, měsíce (YYYY-MM) v hlavičce. Volitelný. */
function parseBalances(wb: ExcelJS.Workbook): ImportedBalance[] {
  const sheet = wb.getWorksheet(SHEETS.balances);
  if (!sheet) {
    return [];
  }
  const header = sheet.getRow(TABLE_HEADER_ROW);
  const months: { column: number; month: string }[] = [];
  for (let column = 2; column <= sheet.columnCount; column++) {
    const month = balanceMonthOf(header.getCell(column));
    if (month) {
      months.push({ column, month });
    }
  }
  return rowsWithKey(sheet, FIRST_TABLE_ROW, 1)
    .filter((cell) => textOf(cell(1)) !== BALANCE_TOTAL_LABEL)
    .flatMap((cell) =>
      months.flatMap(({ column, month }) => {
        const balance = numberOf(cell(column));
        const accountName = textOf(cell(1)) ?? "";
        return balance == null ? [] : [{ accountName, month, balance }];
      }),
    );
}

function requireSheets(wb: ExcelJS.Workbook): void {
  const missing = [SHEETS.items, SHEETS.accounts].filter(
    (name) => !wb.getWorksheet(name),
  );
  if (missing.length > 0) {
    throw new WorkbookFormatError(
      `V souboru chybí list ${missing.join(" a ")} – nahraj export z aplikace nebo MonkeyBusiness 2.0.xlsx`,
    );
  }
}

export async function loadWorkbook(
  buffer: ArrayBuffer,
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw new WorkbookFormatError("Soubor se nepodařilo přečíst jako .xlsx");
  }
  return wb;
}

export async function parseWorkbook(buffer: ArrayBuffer): Promise<ImportData> {
  const wb = await loadWorkbook(buffer);
  requireSheets(wb);
  const warnings: string[] = [];
  const startCell = wb.getWorksheet(SHEETS.accounts)?.getCell(START_DATE_CELL);
  return {
    startDate: startCell ? dateOf(startCell) : null,
    accounts: uniqueBy(parseAccounts(wb), (a) => a.name, "Účet", warnings),
    counterparties: uniqueBy(
      parseCounterparties(wb),
      (c) => c.name,
      "Protistrana",
      warnings,
    ),
    templates: uniqueBy(parseTemplates(wb), (t) => t.code, "Šablona", warnings),
    insurance: parseInsurance(wb),
    items: uniqueBy(
      parseItems(wb, warnings),
      (i) => i.code,
      "Položka",
      warnings,
    ),
    entries: parseMonthSheets(wb),
    corrections: parseCorrections(wb),
    balances: parseBalances(wb),
    warnings,
  };
}

import type {
  AccountBalance,
  BalanceInput,
  ExcelBalanceAssignment,
  ExcelBalanceBlock,
} from "../../contracts.ts";
import { db, type Executor } from "../../db/index.ts";
import { accounts } from "../../db/schema.ts";
import { suggestAccount } from "../../domain/accountMatch.ts";
import { monthKeyOfDate, nearestMonthKey } from "../../domain/month.ts";
import { invalidInput, withDbErrors } from "../../lib/errors.ts";
import { todayInPrague } from "../../lib/today.ts";
import { nextSortOrder } from "../catalog/accounts.ts";
import { parseSavingsBlocks } from "../excel/parseSavingsBlocks.ts";
import { loadWorkbook, WorkbookFormatError } from "../excel/parseWorkbook.ts";
import { loadBalances, writeMonthBalances } from "./service.ts";

// Nejčastější chyba je nový účet se jménem, které už existuje.
const ENTITY = "Účet";

interface AccountAmount {
  accountId: number;
  balance: number;
}

async function readSavingsBlocks(file: File) {
  try {
    return parseSavingsBlocks(await loadWorkbook(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof WorkbookFormatError) {
      throw invalidInput(error.message);
    }
    throw error;
  }
}

/** Najde v Excelu bloky „Stávající stav“ a ke každému řádku navrhne účet. Nic neukládá. */
export async function previewExcelBalances(
  file: File,
): Promise<ExcelBalanceBlock[]> {
  const blocks = await readSavingsBlocks(file);
  if (blocks.length === 0) {
    throw invalidInput(
      "V souboru jsem nenašel blok „Stávající stav“ pod názvem měsíce (např. „říjen“)",
    );
  }
  const existing = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts);
  const reference = monthKeyOfDate(todayInPrague());
  return blocks.map((block) => ({
    title: block.title,
    month: nearestMonthKey(block.monthNumber, reference),
    rows: block.rows.map((row) => ({
      ...row,
      suggestedAccountId: suggestAccount(row.label, existing),
    })),
  }));
}

async function createSavingsAccount(
  executor: Executor,
  name: string,
): Promise<number> {
  const [created] = await executor
    .insert(accounts)
    .values({ name, kind: "savings", sortOrder: await nextSortOrder(executor) })
    .returning({ id: accounts.id });
  if (!created) {
    throw new Error(`Účet „${name}“ se nepodařilo založit`);
  }
  return created.id;
}

/** Přiřadí řádkům id účtů; „new“ založí spořicí účet (stejný název jen jednou). */
async function resolveAccounts(
  executor: Executor,
  assignments: ExcelBalanceAssignment[],
): Promise<AccountAmount[]> {
  const createdByName = new Map<string, number>();
  const resolved: AccountAmount[] = [];
  for (const { label, balance, target } of assignments) {
    if (target !== "new") {
      resolved.push({ accountId: target, balance });
      continue;
    }
    const accountId =
      createdByName.get(label) ?? (await createSavingsAccount(executor, label));
    createdByName.set(label, accountId);
    resolved.push({ accountId, balance });
  }
  return resolved;
}

/** Víc řádků na jeden účet se sečte (např. dvě hotovosti do jedné). */
function sumByAccount(amounts: AccountAmount[]): BalanceInput[] {
  const totals = new Map<number, number>();
  for (const { accountId, balance } of amounts) {
    totals.set(accountId, (totals.get(accountId) ?? 0) + balance);
  }
  return [...totals].map(([accountId, balance]) => ({ accountId, balance }));
}

/** Zapíše vybrané řádky z Excelu do měsíce; nové účty založí ve stejné transakci. */
export async function applyExcelBalances(
  month: string,
  assignments: ExcelBalanceAssignment[],
): Promise<AccountBalance[]> {
  await withDbErrors(ENTITY, () =>
    db.transaction(async (tx) => {
      const amounts = await resolveAccounts(tx, assignments);
      await writeMonthBalances(tx, month, sumByAccount(amounts));
    }),
  );
  return loadBalances();
}

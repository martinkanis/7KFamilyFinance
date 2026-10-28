import { and, asc, eq } from "drizzle-orm";
import type { AccountBalance, BalanceInput } from "../../contracts.ts";
import { db, type Executor } from "../../db/index.ts";
import { accountBalances } from "../../db/schema.ts";
import { withDbErrors } from "../../lib/errors.ts";

const ENTITY = "Zůstatek účtu";

export function loadBalances(
  executor: Executor = db,
): Promise<AccountBalance[]> {
  return executor
    .select({
      accountId: accountBalances.accountId,
      month: accountBalances.month,
      balance: accountBalances.balance,
    })
    .from(accountBalances)
    .orderBy(asc(accountBalances.month), asc(accountBalances.accountId));
}

function saveBalance(executor: Executor, month: string, input: BalanceInput) {
  const sameRow = and(
    eq(accountBalances.month, month),
    eq(accountBalances.accountId, input.accountId),
  );
  if (input.balance == null) {
    return executor.delete(accountBalances).where(sameRow);
  }
  return executor
    .insert(accountBalances)
    .values({ month, accountId: input.accountId, balance: input.balance })
    .onConflictDoUpdate({
      target: [accountBalances.accountId, accountBalances.month],
      set: { balance: input.balance },
    });
}

/** Zapíše zůstatky jednoho měsíce; volající řídí transakci. */
export async function writeMonthBalances(
  executor: Executor,
  month: string,
  inputs: BalanceInput[],
): Promise<void> {
  for (const input of inputs) {
    await saveBalance(executor, month, input);
  }
}

/** Uloží zůstatky jednoho měsíce (jeden i víc účtů najednou) a vrátí všechny. */
export async function saveMonthBalances(
  month: string,
  inputs: BalanceInput[],
): Promise<AccountBalance[]> {
  await withDbErrors(ENTITY, () =>
    db.transaction((tx) => writeMonthBalances(tx, month, inputs)),
  );
  return loadBalances();
}

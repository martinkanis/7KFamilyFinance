import type { Account } from "@kkff/api/contracts";

/**
 * Účty do výběru „Náš účet“: platební účty a navíc ty, na které už něco odkazuje,
 * aby výběr u starší hodnoty neukazoval prázdno.
 */
export function paymentAccountsWith(
  accounts: Account[],
  usedIds: (number | null | undefined)[] = [],
): Account[] {
  const used = new Set(usedIds.filter((id): id is number => id != null));
  return accounts.filter(
    (account) => account.paymentAccount || used.has(account.id),
  );
}

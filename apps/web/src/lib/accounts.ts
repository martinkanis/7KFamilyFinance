import type { Account } from "@kkff/api/contracts";

export const ACCOUNT_DELETE_WARNING =
  "Smažou se i jeho zapsané zůstatky ve Spoření; u položek a plateb se účet vymaže.";

/**
 * Účty do výběru „Náš účet“: provozní účty (bankovní a hotovost) a navíc ty,
 * na které už něco odkazuje, aby výběr u starší hodnoty neukazoval prázdno.
 */
export function operatingAccountsWith(
  accounts: Account[],
  usedIds: (number | null | undefined)[] = [],
): Account[] {
  const used = new Set(usedIds.filter((id): id is number => id != null));
  return accounts.filter(
    (account) => account.kind === "operating" || used.has(account.id),
  );
}

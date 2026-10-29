import {
  ASSET_GROUPS,
  type AssetGroup,
  assetGroupOf,
} from "@kkff/api/accountTypes";
import type { Account, AccountBalance } from "@kkff/api/contracts";
import { CATEGORICAL_COLORS } from "./chartColors";

export type BalanceLookup = (accountId: number, month: string) => number | null;

export function lookupOf(balances: AccountBalance[]): BalanceLookup {
  const byKey = new Map(
    balances.map((b) => [`${b.accountId}|${b.month}`, b.balance]),
  );
  return (accountId, month) => byKey.get(`${accountId}|${month}`) ?? null;
}

export function monthTotal(
  balances: AccountBalance[],
  month: string,
): number | null {
  const inMonth = balances.filter((b) => b.month === month);
  return inMonth.length === 0
    ? null
    : inMonth.reduce((sum, b) => sum + b.balance, 0);
}

/** Součet zapsaných zůstatků účtů; null, když žádný z nich v měsíci zapsaný není. */
export function groupTotal(
  group: Account[],
  month: string,
  balanceOf: BalanceLookup,
): number | null {
  const values = group
    .map((account) => balanceOf(account.id, month))
    .filter((value): value is number => value != null);
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0);
}

/** Změna proti jinému měsíci jen u účtů zapsaných v obou – chybějící zápis není pokles. */
export function comparableChange(
  group: Account[],
  month: string,
  previousMonth: string,
  balanceOf: BalanceLookup,
): number | null {
  let change: number | null = null;
  for (const account of group) {
    const now = balanceOf(account.id, month);
    const before = balanceOf(account.id, previousMonth);
    if (now != null && before != null) change = (change ?? 0) + now - before;
  }
  return change;
}

/** Poslední měsíc (nejpozději `upTo`), ve kterém je zapsaný nějaký zůstatek. */
export function latestRecordedMonth(
  balances: AccountBalance[],
  upTo: string,
): string | null {
  return balances.reduce<string | null>(
    (latest, b) =>
      b.month <= upTo && (latest == null || b.month > latest)
        ? b.month
        : latest,
    null,
  );
}

// Barva patří skupině, ne jejímu pořadí podle velikosti.
export const ASSET_GROUP_COLORS: Record<AssetGroup, string> = {
  bank: CATEGORICAL_COLORS[0],
  savings: CATEGORICAL_COLORS[1],
  building: CATEGORICAL_COLORS[2],
  investments: CATEGORICAL_COLORS[3],
  other: CATEGORICAL_COLORS[4],
};

export interface AssetGroupRow {
  key: AssetGroup;
  label: string;
  color: string;
  accounts: Account[];
}

/** Skupiny majetku v pevném pořadí, jen ty, které mají nějaký účet. */
export function assetGroupsOf(accounts: Account[]): AssetGroupRow[] {
  return ASSET_GROUPS.map(({ key, label }) => ({
    key,
    label,
    color: ASSET_GROUP_COLORS[key],
    accounts: accounts.filter((account) => assetGroupOf(account.type) === key),
  })).filter((group) => group.accounts.length > 0);
}

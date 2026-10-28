import type { AccountBalance } from "../contracts.ts";
import { roundMoney } from "./planner.ts";

/** Skutečný majetek v měsíci = součet zapsaných zůstatků (jen měsíce, kde nějaký je). */
export function actualWealthByMonth(
  balances: AccountBalance[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const { month, balance } of balances) {
    totals.set(month, roundMoney((totals.get(month) ?? 0) + balance));
  }
  return totals;
}

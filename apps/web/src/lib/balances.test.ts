import { describe, expect, it } from "bun:test";
import type { Account, AccountBalance } from "@kkff/api/contracts";
import {
  assetGroupsOf,
  comparableChange,
  groupTotal,
  latestRecordedMonth,
  lookupOf,
} from "./balances.ts";

const account = (id: number, type: string | null): Account => ({
  id,
  name: `Účet ${id}`,
  institution: null,
  owner: null,
  type,
  number: null,
  kind: "savings",
  currency: "CZK",
  initialBalance: 0,
  note: null,
  sortOrder: id,
});

const balances: AccountBalance[] = [
  { accountId: 1, month: "2026-09", balance: 1000 },
  { accountId: 2, month: "2026-09", balance: 500 },
  { accountId: 1, month: "2026-10", balance: 1200 },
];

describe("přehled stavu účtů", () => {
  it("najde poslední měsíc se zapsaným stavem", () => {
    expect(latestRecordedMonth(balances, "2026-12")).toBe("2026-10");
    expect(latestRecordedMonth(balances, "2026-09")).toBe("2026-09");
    expect(latestRecordedMonth(balances, "2026-08")).toBeNull();
  });

  it("sečte jen zapsané zůstatky skupiny", () => {
    const balanceOf = lookupOf(balances);
    const group = [account(1, null), account(2, null)];
    expect(groupTotal(group, "2026-09", balanceOf)).toBe(1500);
    expect(groupTotal(group, "2026-10", balanceOf)).toBe(1200);
    expect(groupTotal(group, "2026-11", balanceOf)).toBeNull();
  });

  it("změnu počítá jen z účtů zapsaných v obou měsících", () => {
    const balanceOf = lookupOf(balances);
    const group = [account(1, null), account(2, null)];
    // účet 2 za říjen chybí – nesmí to vypadat jako pokles o 500
    expect(comparableChange(group, "2026-10", "2026-09", balanceOf)).toBe(200);
    expect(comparableChange(group, "2026-11", "2026-10", balanceOf)).toBeNull();
  });

  it("rozdělí účty do skupin v pevném pořadí a vynechá prázdné", () => {
    const groups = assetGroupsOf([
      account(1, "Kryptoměny"),
      account(2, "Bankovní účet"),
      account(3, "Hotovost"),
      account(4, "Akcie"),
    ]);
    expect(groups.map((g) => g.label)).toEqual([
      "Bankovní účty",
      "Akcie a kryptoměny",
      "Ostatní",
    ]);
    expect(groups[1]?.accounts.map((a) => a.id)).toEqual([1, 4]);
  });
});

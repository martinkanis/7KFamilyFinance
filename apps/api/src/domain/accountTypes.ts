import type { AccountKind } from "../contracts.ts";

// Sdílí API (import Excelu) i web (formulář účtu) přes `@kkff/api/accountTypes`.

export const ACCOUNT_TYPES: Record<AccountKind, readonly string[]> = {
  operating: ["Bankovní účet", "Hotovost"],
  savings: [
    "ETF & akcie",
    "Bankovní spořicí účet",
    "Stavební spoření",
    "Penzijní spoření",
    "Akcie",
    "Kryptoměny",
  ],
};

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  operating: "Provozní",
  savings: "Spořicí",
};

/** Názvy typů ze starších sešitů (MonkeyBusiness 2.0). */
const LEGACY_TYPE_NAMES: Record<string, string> = {
  "Běžný účet": "Bankovní účet",
  "Spořicí účet": "Bankovní spořicí účet",
};

export function normalizeAccountType(type: string | null): string | null {
  return type == null ? null : (LEGACY_TYPE_NAMES[type] ?? type);
}

export function defaultKindForType(type: string | null): AccountKind {
  const normalized = normalizeAccountType(type);
  return normalized != null && ACCOUNT_TYPES.operating.includes(normalized)
    ? "operating"
    : "savings";
}

/** Skupiny majetku pro přehled na stránce Spoření. */
export type AssetGroup =
  | "bank"
  | "savings"
  | "building"
  | "investments"
  | "other";

export const ASSET_GROUPS: readonly { key: AssetGroup; label: string }[] = [
  { key: "bank", label: "Bankovní účty" },
  { key: "savings", label: "Spoření" },
  { key: "building", label: "Stavební spoření" },
  { key: "investments", label: "Akcie a kryptoměny" },
  { key: "other", label: "Ostatní" },
];

const GROUP_BY_TYPE: Record<string, AssetGroup> = {
  "Bankovní účet": "bank",
  "Bankovní spořicí účet": "savings",
  "Penzijní spoření": "savings",
  "Stavební spoření": "building",
  "ETF & akcie": "investments",
  Akcie: "investments",
  Kryptoměny: "investments",
};

/** Hotovost, účty bez typu a vlastní typy patří do „Ostatní“. */
export function assetGroupOf(type: string | null): AssetGroup {
  const normalized = normalizeAccountType(type);
  return (
    (normalized == null ? undefined : GROUP_BY_TYPE[normalized]) ?? "other"
  );
}

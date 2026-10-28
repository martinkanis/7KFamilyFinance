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

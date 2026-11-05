import type { Account, Counterparty } from "@kkff/api/contracts";

export interface ComboOption {
  value: string;
  label: string;
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Možnosti, ve kterých jsou všechna slova dotazu (bez ohledu na diakritiku a velikost). */
export function filterOptions(
  options: ComboOption[],
  query: string,
): ComboOption[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return options;
  return options.filter((option) => {
    const haystack = fold(`${option.label} ${option.value}`);
    return words.every((word) => haystack.includes(word));
  });
}

/** Účty k výběru u „účtu protistrany“: protistrany a naše účty (převody). */
export function counterpartyAccountOptions(
  counterparties: Counterparty[],
  accounts: Account[],
): ComboOption[] {
  const options = [
    ...counterparties.map((c) => ({ value: c.accountNumber, label: c.name })),
    ...accounts.map((a) => ({
      value: a.number,
      label: `${a.name} (náš účet)`,
    })),
  ].filter((o): o is ComboOption => o.value != null && o.value.trim() !== "");
  const seen = new Set<string>();
  return options
    .filter((o) => {
      const key = `${o.label}|${o.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.label.localeCompare(b.label, "cs"));
}

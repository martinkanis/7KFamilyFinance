import type { Account } from "../contracts.ts";

// Slova se porovnávají podle prvních čtyř písmen: Excel zkracuje a skloňuje
// („stavebko“ × „stavební“, „Raifka“ × „Raiffka“, „spoř“ × „spoření“).
const STEM_LENGTH = 4;

// Musí být ostře víc než polovina, jinak by „Petra Portu“ spadla na účet „Portu“.
const MIN_SIMILARITY = 0.5;

function stemsOf(name: string): Set<string> {
  const plain = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const words = plain.split(/[^a-z0-9]+/).filter(Boolean);
  return new Set(words.map((word) => word.slice(0, STEM_LENGTH)));
}

/** Podíl společných slov – nezáleží na pořadí, pomlčkách, velikosti písmen ani diakritice. */
function similarity(a: Set<string>, b: Set<string>): number {
  const shared = [...a].filter((stem) => b.has(stem)).length;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

/** Účet, jehož název se nejvíc podobá popisku z Excelu; null, když žádný dost. */
export function suggestAccount(
  label: string,
  accounts: Pick<Account, "id" | "name">[],
): number | null {
  const labelStems = stemsOf(label);
  let best: { id: number; score: number } | null = null;
  for (const account of accounts) {
    const score = similarity(labelStems, stemsOf(account.name));
    if (score > MIN_SIMILARITY && (best == null || score > best.score)) {
      best = { id: account.id, score };
    }
  }
  return best?.id ?? null;
}

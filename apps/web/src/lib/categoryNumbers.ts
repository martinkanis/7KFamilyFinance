/** Číslo, které už kategorie má v názvu (např. „1. Bydlení“ z Excelu). */
const LEADING_NUMBER = /^\s*\d+\s*[.)]\s*/;

/** Název kategorie s číslem podle pořadí; staré číslo z názvu se nahradí. */
export function numberedCategory(name: string, number: number | null): string {
  if (number == null || number < 1) return name;
  const bare = name.replace(LEADING_NUMBER, "") || name;
  return `${number}. ${bare}`;
}

/** Pořadové číslo kategorie (od 1) v seznamu kategorií směru; null, když v něm není. */
export function categoryNumber(
  categories: string[],
  name: string,
): number | null {
  const index = categories.indexOf(name);
  return index < 0 ? null : index + 1;
}

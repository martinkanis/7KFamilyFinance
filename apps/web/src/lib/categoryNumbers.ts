import { type TreeNode, treeOrder } from "@kkff/api/categoryTree";

/** Číslo, které už kategorie má v názvu (např. „1. Bydlení“ z Excelu). */
const LEADING_NUMBER = /^\s*\d+(\.\d+)*\s*[.)]\s*/;

/** Název kategorie s číslem podle pořadí (i „1.2“); staré číslo z názvu se nahradí. */
export function numberedCategory(
  name: string,
  number: number | string | null,
): string {
  if (number == null || number === "" || number === 0) return name;
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

/** Čísla kategorií podle stromu („1“, „1.2“, „1.2.1“). */
export function treeNumbers(nodes: TreeNode[]): Map<string, string> {
  return new Map(treeOrder(nodes).map((node) => [node.name, node.number]));
}

// Strom kategorií: kategorie může mít nadřazenou kategorii (libovolně hluboko).
// Sdílí API (ukládání pořadí, výpočet měsíce) i web (zobrazení, přetahování)
// přes `@kkff/api/categoryTree`.

export interface TreeNode {
  name: string;
  /** Název nadřazené kategorie; null = nejvyšší úroveň. */
  parent: string | null;
}

export interface OrderedNode extends TreeNode {
  depth: number;
  /** Číslo podle pořadí ve stromu, např. „1.2“. */
  number: string;
}

/**
 * Seřadí kategorie do stromu (nadřazená vždy před svými podkategoriemi,
 * sourozenci v pořadí ze vstupu). Duplicitní název se vezme poprvé;
 * neexistující nadřazená kategorie nebo cyklus z kategorie udělá nejvyšší úroveň.
 */
export function treeOrder(nodes: TreeNode[]): OrderedNode[] {
  const byName = new Map<string, TreeNode>();
  for (const node of nodes) {
    if (!byName.has(node.name)) byName.set(node.name, node);
  }
  const parentOf = (name: string): string | null => {
    const parent = byName.get(name)?.parent ?? null;
    return parent != null && parent !== name && byName.has(parent)
      ? parent
      : null;
  };
  const inCycle = (name: string): boolean => {
    const seen = new Set<string>([name]);
    for (let p = parentOf(name); p != null; p = parentOf(p)) {
      if (seen.has(p)) return true;
      seen.add(p);
    }
    return false;
  };
  const effectiveParent = (name: string) =>
    inCycle(name) ? null : parentOf(name);
  const children = new Map<string | null, string[]>();
  for (const name of byName.keys()) {
    const parent = effectiveParent(name);
    children.set(parent, [...(children.get(parent) ?? []), name]);
  }
  const result: OrderedNode[] = [];
  const visit = (parent: string | null, depth: number, prefix: string) => {
    for (const [index, name] of (children.get(parent) ?? []).entries()) {
      const number = `${prefix}${index + 1}`;
      result.push({ name, parent, depth, number });
      visit(name, depth + 1, `${number}.`);
    }
  };
  visit(null, 0, "");
  return result;
}

/** Kategorie a všechny její podkategorie (v pořadí stromu). */
export function subtreeOf(ordered: OrderedNode[], name: string): string[] {
  const start = ordered.findIndex((node) => node.name === name);
  if (start < 0) return [];
  const depth = ordered[start]?.depth ?? 0;
  const result = [name];
  for (let i = start + 1; i < ordered.length; i++) {
    const node = ordered[i];
    if (!node || node.depth <= depth) break;
    result.push(node.name);
  }
  return result;
}

/** Kategorie nejvyšší úrovně, pod kterou kategorie patří. */
export function rootOf(nodes: TreeNode[], name: string): string {
  const parentOf = new Map(nodes.map((node) => [node.name, node.parent]));
  let current = name;
  const seen = new Set<string>();
  while (!seen.has(current)) {
    seen.add(current);
    const parent = parentOf.get(current);
    if (parent == null || !parentOf.has(parent)) return current;
    current = parent;
  }
  return name;
}

export type TreeDrop = "before" | "after" | "into";

/**
 * Přesun kategorie (i s podkategoriemi) před/za jinou, nebo do ní jako
 * poslední podkategorie. Null, když by se kategorie přesunula sama do sebe.
 */
export function moveNode(
  nodes: TreeNode[],
  dragged: string,
  target: string,
  drop: TreeDrop,
): TreeNode[] | null {
  const ordered = treeOrder(nodes);
  const moving = subtreeOf(ordered, dragged);
  if (moving.length === 0 || moving.includes(target)) return null;
  const targetNode = ordered.find((node) => node.name === target);
  if (!targetNode) return null;
  const rest = ordered.filter((node) => !moving.includes(node.name));
  const movingNodes = ordered
    .filter((node) => moving.includes(node.name))
    .map((node) =>
      node.name === dragged
        ? {
            ...node,
            parent: drop === "into" ? target : targetNode.parent,
          }
        : node,
    );
  const targetIndex = rest.findIndex((node) => node.name === target);
  const targetSubtree = subtreeOf(rest as OrderedNode[], target);
  const insertAt =
    drop === "before" ? targetIndex : targetIndex + targetSubtree.length;
  const result = [...rest];
  result.splice(insertAt, 0, ...movingNodes);
  return result.map(({ name, parent }) => ({ name, parent }));
}

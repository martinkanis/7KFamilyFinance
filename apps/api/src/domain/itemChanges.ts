import type {
  ChangeableField,
  Item,
  ItemChange,
  MonthOverrides,
} from "../contracts.ts";

export const CHANGEABLE_FIELDS: ChangeableField[] = [
  "amount",
  "dueDay",
  "ourAccountId",
  "counterpartyAccount",
  "vs",
];

export type ChangeValues = Partial<MonthOverrides>;

/**
 * Položka s hodnotami platnými v měsíci: každá hodnota z poslední změny
 * s platností od tohoto měsíce nebo dříve; bez změn = výchozí hodnoty položky.
 */
export function itemAsOf<T extends Item>(
  item: T,
  changes: ItemChange[],
  month: string,
): T {
  const applicable = changes
    .filter((change) => change.itemId === item.id && change.fromMonth <= month)
    .sort((a, b) => a.fromMonth.localeCompare(b.fromMonth));
  const result: T = { ...item };
  for (const change of applicable) {
    for (const field of CHANGEABLE_FIELDS) {
      const value = change[field];
      if (value != null) Object.assign(result, { [field]: value });
    }
    // Pevná částka od měsíce má přednost před rezervou z pojistek.
    if (change.amount != null) result.amountFromInsurance = false;
  }
  return result;
}

/** Měnitelné hodnoty, které se v `next` liší od `current`. */
export function changedValues(
  current: Pick<Item, ChangeableField>,
  next: Pick<Item, ChangeableField>,
): ChangeValues {
  const changed: ChangeValues = {};
  for (const field of CHANGEABLE_FIELDS) {
    if (next[field] !== current[field]) {
      Object.assign(changed, { [field]: next[field] });
    }
  }
  return changed;
}

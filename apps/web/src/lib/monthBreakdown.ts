import type { Direction, MonthRow, NamedRef } from "@kkff/api/contracts";
import { categoricalColor, UNASSIGNED_COLOR } from "./chartColors";
import { groupByCategory, settledAmount } from "./monthRows";

export interface CategorySegment {
  key: string;
  label: string;
  color: string;
  /** Plán kategorie v měsíci. */
  value: number;
  remaining: number;
  /** Rozdíl plánu proti minulému měsíci; null, když minulý měsíc není načtený. */
  change: number | null;
}

/**
 * Kategorie jednoho směru v pořadí, v jakém jsou v měsíci (barva se tak
 * nemění podle velikosti); kategorie s nulovým plánem se vynechají.
 */
export function categoryBreakdown(
  rows: MonthRow[],
  direction: Direction,
  previousRows: MonthRow[] | null,
): CategorySegment[] {
  const groups = groupByCategory(rows.filter((r) => r.direction === direction));
  const previous = previousRows
    ? groupByCategory(previousRows.filter((r) => r.direction === direction))
    : null;
  const previousPlan = (category: string) =>
    previous
      ? (previous.find((g) => g.category === category)?.plan ?? 0)
      : null;
  const segments = groups.map((group) => {
    const before = previousPlan(group.category);
    return {
      key: group.category,
      label: group.category,
      value: group.plan,
      remaining: group.remaining,
      change: before == null ? null : group.plan - before,
    };
  });
  return segments
    .map((segment, index) => ({
      ...segment,
      color: categoricalColor(index),
    }))
    .filter((segment) => segment.value !== 0);
}

export const UNASSIGNED_KEY = "__none";

/**
 * Rozpad směru podle typu (nadkategorie, typ platby). Barva podle pořadí typu
 * v seznamu, platby bez typu jsou šedě na konci; prázdné typy se vynechají.
 */
export function typeBreakdown(
  rows: MonthRow[],
  direction: Direction,
  types: NamedRef[],
  typeOf: (row: MonthRow) => number | null,
  unassignedLabel: string,
): CategorySegment[] {
  const relevant = rows.filter((row) => row.direction === direction);
  const groups = [
    ...types.map((type, index) => ({
      key: String(type.id),
      label: type.name,
      color: categoricalColor(index),
      rows: relevant.filter((row) => typeOf(row) === type.id),
    })),
    {
      key: UNASSIGNED_KEY,
      label: unassignedLabel,
      color: UNASSIGNED_COLOR,
      rows: relevant.filter((row) => {
        const id = typeOf(row);
        return id == null || !types.some((type) => type.id === id);
      }),
    },
  ];
  return groups
    .map(({ rows: groupRows, ...group }) => ({
      ...group,
      value: groupRows.reduce((sum, row) => sum + row.amount, 0),
      remaining: groupRows.reduce(
        (sum, row) => sum + row.amount - settledAmount(row),
        0,
      ),
      change: null,
    }))
    .filter((segment) => segment.value !== 0);
}

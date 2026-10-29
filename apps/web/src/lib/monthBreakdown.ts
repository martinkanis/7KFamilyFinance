import type { Direction, MonthRow } from "@kkff/api/contracts";
import { CATEGORICAL_COLORS } from "./chartColors";
import { groupByCategory } from "./monthRows";

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

const OTHER_KEY = "__other";

function sumOrNull(values: (number | null)[]): number | null {
  return values.some((v) => v == null)
    ? null
    : values.reduce<number>((sum, v) => sum + (v ?? 0), 0);
}

/**
 * Kategorie jednoho směru v pořadí, v jakém jsou v měsíci (barva se tak
 * nemění podle velikosti). Nad osm kategorií se zbytek sloučí do „Ostatní“;
 * kategorie s nulovým plánem se vynechají.
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
  let segments = groups.map((group) => {
    const before = previousPlan(group.category);
    return {
      key: group.category,
      label: group.category,
      value: group.plan,
      remaining: group.remaining,
      change: before == null ? null : group.plan - before,
    };
  });
  const maxSlots = CATEGORICAL_COLORS.length;
  if (segments.length > maxSlots) {
    const rest = segments.slice(maxSlots - 1);
    segments = [
      ...segments.slice(0, maxSlots - 1),
      {
        key: OTHER_KEY,
        label: "Ostatní kategorie",
        value: rest.reduce((sum, s) => sum + s.value, 0),
        remaining: rest.reduce((sum, s) => sum + s.remaining, 0),
        change: sumOrNull(rest.map((s) => s.change)),
      },
    ];
  }
  return segments
    .map((segment, index) => ({
      ...segment,
      color: CATEGORICAL_COLORS[index] ?? CATEGORICAL_COLORS[0],
    }))
    .filter((segment) => segment.value !== 0);
}

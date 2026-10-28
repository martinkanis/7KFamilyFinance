import type { CategoryMatrix, Direction, MonthRow } from "../contracts.ts";
import { roundMoney } from "./planner.ts";

/** Plán podle kategorií × měsíců; kategorie v pořadí, v jakém se objeví v řádcích. */
export function buildCategoryMatrix(
  direction: Direction,
  rowsByMonth: MonthRow[][],
): CategoryMatrix {
  const categories: string[] = [];
  for (const row of rowsByMonth.flat()) {
    if (row.direction === direction && !categories.includes(row.category)) {
      categories.push(row.category);
    }
  }
  const rows = categories.map((category) => {
    const amounts = rowsByMonth.map((monthRows) =>
      roundMoney(
        monthRows
          .filter((row) => row.direction === direction)
          .filter((row) => row.category === category)
          .reduce((sum, row) => sum + row.amount, 0),
      ),
    );
    const total = roundMoney(amounts.reduce((sum, amount) => sum + amount, 0));
    return { category, amounts, total };
  });
  return { direction, rows };
}

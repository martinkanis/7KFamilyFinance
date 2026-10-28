/** Ořízne textové hodnoty a prázdné texty uloží jako null (schéma už vyloučilo prázdné povinné texty). */
export function normalizeTexts<T extends object>(input: T): T {
  const entries = Object.entries(input).map(([key, value]) => {
    if (typeof value !== "string") {
      return [key, value];
    }
    const trimmed = value.trim();
    return [key, trimmed === "" ? null : trimmed];
  });
  return Object.fromEntries(entries) as T;
}

export function firstOrThrow<T>(rows: T[], error: () => Error): T {
  const [row] = rows;
  if (row === undefined) {
    throw error();
  }
  return row;
}

// Ověřená kategorická paleta (odlišitelná i při barvosleposti) v pevném
// pořadí – přiděluje se postupně, nikdy dokola. Devátá a další skupina
// se slučuje do „Ostatní“.
export const CATEGORICAL_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#6250d6",
  "#e34948",
] as const;

/** Barva n-té skupiny; za osmou se paleta opakuje ve světlejším odstínu. */
export function categoricalColor(index: number): string {
  const base = CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length] ?? "#888";
  const round = Math.floor(index / CATEGORICAL_COLORS.length);
  if (round === 0) return base;
  const tint = Math.min(0.25 * round, 0.6);
  const channel = (offset: number) => {
    const value = Number.parseInt(base.slice(offset, offset + 2), 16);
    return Math.round(value + (255 - value) * tint)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/** Skupina „bez typu“ – neutrální, aby se nepletla s typem. */
export const UNASSIGNED_COLOR = "#cbd5e1";

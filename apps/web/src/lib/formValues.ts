// Převod textů z formulářů na typované hodnoty (prázdné pole = null).

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function textOrNull(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : trimmed;
}

/** „1 234,50“ i „1234.5“ → 1234.5; prázdné → null. */
export function parseOptionalNumber(
  text: string,
  label: string,
): Parsed<number | null> {
  const normalized = text.replace(/[\s ]/g, "").replace(",", ".");
  if (normalized === "") {
    return { ok: true, value: null };
  }
  const value = Number(normalized);
  return Number.isFinite(value)
    ? { ok: true, value }
    : { ok: false, error: `${label}: „${text}“ není číslo` };
}

export function parseOptionalDay(text: string): Parsed<number | null> {
  const parsed = parseOptionalNumber(text, "Den splatnosti");
  if (!parsed.ok || parsed.value == null) {
    return parsed;
  }
  const isDay =
    Number.isInteger(parsed.value) && parsed.value >= 1 && parsed.value <= 31;
  return isDay ? parsed : { ok: false, error: "Den splatnosti musí být 1–31" };
}

export function idOrNull(text: string): number | null {
  return text === "" ? null : Number(text);
}

export function toText(value: string | number | null | undefined): string {
  return value == null ? "" : String(value);
}

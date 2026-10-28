import type { FieldValue, Payload } from "@/lib/api";
import {
  idOrNull,
  type Parsed,
  parseOptionalNumber,
  textOrNull,
  toText,
} from "@/lib/formValues";

export type FieldKind =
  | "text"
  | "textarea"
  | "money"
  | "integer"
  | "date"
  | "checkbox"
  | "select"
  | "datalist";

export interface Option {
  value: string;
  label: string;
}

export interface FieldDef<T> {
  key: keyof T & string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** select s číselnými ID (účty, protistrany…) */
  numericOptions?: boolean;
  options?: Option[];
  hint?: string;
  wide?: boolean;
  placeholder?: string;
}

export type FormValues = Record<string, string | boolean>;

function formValueOf(value: unknown): string | boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    return toText(value);
  }
  return "";
}

export function formFromRow<T>(fields: FieldDef<T>[], row: T): FormValues {
  return Object.fromEntries(
    fields.map((field) => [field.key, formValueOf(row[field.key])]),
  );
}

export function emptyForm<T>(
  fields: FieldDef<T>[],
  defaults: FormValues = {},
): FormValues {
  return Object.fromEntries(
    fields.map((field) => [
      field.key,
      defaults[field.key] ?? (field.kind === "checkbox" ? false : ""),
    ]),
  );
}

function parseInteger(text: string, label: string): Parsed<number | null> {
  const parsed = parseOptionalNumber(text, label);
  if (parsed.ok && parsed.value != null && !Number.isInteger(parsed.value)) {
    return { ok: false, error: `${label} musí být celé číslo` };
  }
  return parsed;
}

function parseField<T>(
  field: FieldDef<T>,
  raw: string | boolean,
): Parsed<FieldValue> {
  if (field.kind === "checkbox") {
    return { ok: true, value: raw === true };
  }
  const text = typeof raw === "string" ? raw : "";
  switch (field.kind) {
    case "money":
      return parseOptionalNumber(text, field.label);
    case "integer":
      return parseInteger(text, field.label);
    case "select":
      return {
        ok: true,
        value: field.numericOptions ? idOrNull(text) : textOrNull(text),
      };
    default:
      return { ok: true, value: textOrNull(text) };
  }
}

/** Formulář → payload pro API; server ho validuje znovu (hranice systému). */
export function toPayload<T>(
  fields: FieldDef<T>[],
  values: FormValues,
): Payload | string {
  const payload: Payload = {};
  for (const field of fields) {
    const parsed = parseField(field, values[field.key] ?? "");
    if (!parsed.ok) {
      return parsed.error;
    }
    if (field.required && parsed.value == null) {
      return `Vyplň pole „${field.label}“`;
    }
    payload[field.key] = parsed.value;
  }
  return payload;
}

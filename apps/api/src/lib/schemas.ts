import { t } from "elysia";

const MAX_MONEY = 100_000_000_000;

export const requiredText = (maxLength = 200) =>
  t.String({ minLength: 1, maxLength, pattern: "\\S" });

export const nullableText = (maxLength = 500) =>
  t.Union([t.String({ maxLength }), t.Null()]);

export const moneySchema = t.Number({
  minimum: -MAX_MONEY,
  maximum: MAX_MONEY,
});

export const nullableMoney = t.Union([moneySchema, t.Null()]);

export const nullableId = t.Union([t.Integer({ minimum: 1 }), t.Null()]);

export const isoDateSchema = t.String({
  pattern: "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$",
});

export const nullableDate = t.Union([isoDateSchema, t.Null()]);

export const nullableDueDay = t.Union([
  t.Integer({ minimum: 1, maximum: 31 }),
  t.Null(),
]);

export const monthKeySchema = t.String({ pattern: "^\\d{4}-(0[1-9]|1[0-2])$" });

export const idParams = t.Object({ id: t.Numeric({ minimum: 1 }) });

export const nullableUrl = t.Union([
  t.String({ maxLength: 500, pattern: "^https?://" }),
  t.Null(),
]);

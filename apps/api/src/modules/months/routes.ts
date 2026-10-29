import { Elysia, t } from "elysia";
import type { MonthView } from "../../contracts.ts";
import {
  moneySchema,
  monthKeySchema,
  nullableDate,
  nullableDueDay,
  nullableId,
  nullableMoney,
  nullableText,
  requiredText,
} from "../../lib/schemas.ts";
import {
  createOneOff,
  deleteOneOff,
  endItemFrom,
  getMonthView,
  saveCorrection,
  saveItemEntry,
  updateOneOff,
} from "./service.ts";

const entryFields = {
  status: t.Union([
    t.Literal("unpaid"),
    t.Literal("processing"),
    t.Literal("paid"),
  ]),
  paidOn: nullableDate,
  note: nullableText(2000),
  amount: nullableMoney,
  dueDay: nullableDueDay,
  ourAccountId: nullableId,
  counterpartyAccount: nullableText(64),
  vs: nullableText(10),
};

const entryBody = t.Object(entryFields);

const oneOffBody = t.Object({
  ...entryFields,
  direction: t.Union([t.Literal("expense"), t.Literal("income")]),
  category: requiredText(),
  name: requiredText(),
  counterpartyId: nullableId,
});

const monthParams = t.Object({ month: monthKeySchema });
const monthItemParams = t.Object({
  month: monthKeySchema,
  itemId: t.Numeric({ minimum: 1 }),
});
const monthEntryParams = t.Object({
  month: monthKeySchema,
  id: t.Numeric({ minimum: 1 }),
});

// Každá změna vrací čerstvý pohled na měsíc, aby klient nemusel dotahovat souhrny.
export const monthRoutes = new Elysia({ prefix: "/api/months/:month" })
  .get("/", ({ params }): Promise<MonthView> => getMonthView(params.month), {
    params: monthParams,
  })
  .put(
    "/items/:itemId",
    async ({ params, body }): Promise<MonthView> => {
      await saveItemEntry(params.month, params.itemId, body);
      return getMonthView(params.month);
    },
    { params: monthItemParams, body: entryBody },
  )
  .delete(
    "/items/:itemId",
    async ({ params }): Promise<MonthView> => {
      await endItemFrom(params.month, params.itemId);
      return getMonthView(params.month);
    },
    { params: monthItemParams },
  )
  .post(
    "/one-offs",
    async ({ params, body }): Promise<MonthView> => {
      await createOneOff(params.month, body);
      return getMonthView(params.month);
    },
    { params: monthParams, body: oneOffBody },
  )
  .put(
    "/one-offs/:id",
    async ({ params, body }): Promise<MonthView> => {
      await updateOneOff(params.month, params.id, body);
      return getMonthView(params.month);
    },
    { params: monthEntryParams, body: oneOffBody },
  )
  .delete(
    "/one-offs/:id",
    async ({ params }): Promise<MonthView> => {
      await deleteOneOff(params.month, params.id);
      return getMonthView(params.month);
    },
    { params: monthEntryParams },
  )
  .put(
    "/correction",
    async ({ params, body }): Promise<MonthView> => {
      await saveCorrection(params.month, body);
      return getMonthView(params.month);
    },
    {
      params: monthParams,
      body: t.Object({ amount: moneySchema, note: nullableText(500) }),
    },
  );

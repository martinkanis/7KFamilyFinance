import { Elysia, t } from "elysia";
import { moneySchema, monthKeySchema } from "../../lib/schemas.ts";
import { loadBalances, saveMonthBalances } from "./service.ts";

export const balanceRoutes = new Elysia({ prefix: "/api/balances" })
  .get("/", () => loadBalances())
  .put("/:month", ({ params, body }) => saveMonthBalances(params.month, body), {
    params: t.Object({ month: monthKeySchema }),
    body: t.Array(
      t.Object({
        accountId: t.Integer({ minimum: 1 }),
        balance: t.Union([moneySchema, t.Null()]),
      }),
      { maxItems: 200 },
    ),
  });

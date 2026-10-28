import { Elysia, t } from "elysia";
import { config } from "../../config.ts";
import {
  moneySchema,
  monthKeySchema,
  requiredText,
} from "../../lib/schemas.ts";
import { applyExcelBalances, previewExcelBalances } from "./excelImport.ts";
import { loadBalances, saveMonthBalances } from "./service.ts";

const MAX_ROWS = 200;
const monthParams = t.Object({ month: monthKeySchema });

export const balanceRoutes = new Elysia({ prefix: "/api/balances" })
  .get("/", () => loadBalances())
  .put("/:month", ({ params, body }) => saveMonthBalances(params.month, body), {
    params: monthParams,
    body: t.Array(
      t.Object({
        accountId: t.Integer({ minimum: 1 }),
        balance: t.Union([moneySchema, t.Null()]),
      }),
      { maxItems: MAX_ROWS },
    ),
  })
  .post("/excel", ({ body }) => previewExcelBalances(body.file), {
    body: t.Object({ file: t.File({ maxSize: config.maxImportBytes }) }),
  })
  .put(
    "/:month/excel",
    ({ params, body }) => applyExcelBalances(params.month, body),
    {
      params: monthParams,
      body: t.Array(
        t.Object({
          label: requiredText(),
          balance: moneySchema,
          target: t.Union([t.Integer({ minimum: 1 }), t.Literal("new")]),
        }),
        { minItems: 1, maxItems: MAX_ROWS },
      ),
    },
  );

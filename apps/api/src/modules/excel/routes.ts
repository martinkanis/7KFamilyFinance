import { asc } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { config } from "../../config.ts";
import type { ImportResult } from "../../contracts.ts";
import { db } from "../../db/index.ts";
import { insurancePolicies } from "../../db/schema.ts";
import { invalidInput } from "../../lib/errors.ts";
import { todayInPrague } from "../../lib/today.ts";
import { computePlanSnapshot } from "../overview/service.ts";
import { buildExportWorkbook } from "./exportWorkbook.ts";
import { replaceAllData } from "./importData.ts";
import { parseWorkbook, WorkbookFormatError } from "./parseWorkbook.ts";

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function exportWorkbook(): Promise<Response> {
  const [snapshot, insurance] = await Promise.all([
    computePlanSnapshot(),
    db.select().from(insurancePolicies).orderBy(asc(insurancePolicies.id)),
  ]);
  const workbook = buildExportWorkbook({ ...snapshot, insurance });
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `7KFamilyFinance-${todayInPrague()}.xlsx`;
  return new Response(buffer, {
    headers: {
      "content-type": XLSX_TYPE,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

async function importWorkbook(file: File): Promise<ImportResult> {
  try {
    const data = await parseWorkbook(await file.arrayBuffer());
    if (data.items.length === 0 && data.accounts.length === 0) {
      throw invalidInput(
        "Soubor neobsahuje žádné položky ani účty – data jsem nepřepsal",
      );
    }
    return await replaceAllData(data);
  } catch (error) {
    if (error instanceof WorkbookFormatError) {
      throw invalidInput(error.message);
    }
    throw error;
  }
}

export const excelRoutes = new Elysia({ prefix: "/api/excel" })
  .get("/export", () => exportWorkbook())
  .post("/import", ({ body }) => importWorkbook(body.file), {
    body: t.Object({
      file: t.File({ maxSize: config.maxImportBytes }),
      // Pojistka proti omylu: import přepíše všechna data.
      confirm: t.Literal("replace-all"),
    }),
  });

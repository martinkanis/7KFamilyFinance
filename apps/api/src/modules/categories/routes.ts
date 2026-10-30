import { Elysia, t } from "elysia";
import { requiredText } from "../../lib/schemas.ts";
import { addCategory, deleteCategory, orderCategories } from "./service.ts";

const direction = t.Union([t.Literal("expense"), t.Literal("income")]);
const categoryName = requiredText();

export const categoryRoutes = new Elysia({ prefix: "/api/categories" })
  .post(
    "/",
    async ({ body }) => {
      await addCategory({ direction: body.direction, name: body.name.trim() });
      return { ok: true };
    },
    { body: t.Object({ direction, name: categoryName }) },
  )
  .put(
    "/order",
    async ({ body }) => {
      await orderCategories(
        body.direction,
        body.names.map((name) => name.trim()),
      );
      return { ok: true };
    },
    {
      body: t.Object({
        direction,
        names: t.Array(categoryName, { maxItems: 500 }),
      }),
    },
  )
  .post(
    "/delete",
    async ({ body }) => {
      await deleteCategory({
        direction: body.direction,
        name: body.name.trim(),
        moveTo: body.moveTo?.trim() || null,
      });
      return { ok: true };
    },
    {
      body: t.Object({
        direction,
        name: categoryName,
        moveTo: t.Union([categoryName, t.Null()]),
      }),
    },
  );

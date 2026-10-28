import { Elysia } from "elysia";
import type { Overview } from "../../contracts.ts";
import { getOverview } from "./service.ts";

export const overviewRoutes = new Elysia({ prefix: "/api/overview" }).get(
  "/",
  (): Promise<Overview> => getOverview(),
);

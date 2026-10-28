import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { currentMonth } from "@/lib/format";
import {
  AccountsPage,
  CounterpartiesPage,
  InsurancePage,
  TemplatesPage,
} from "@/pages/CatalogPages";
import { DataPage } from "@/pages/DataPage";
import { ItemsPage } from "@/pages/ItemsPage";
import { MonthPage } from "@/pages/MonthPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { SavingsPage } from "@/pages/SavingsPage";

const rootRoute = createRootRoute({ component: AppShell });
const getParentRoute = () => rootRoute;

const monthRoute = createRoute({
  getParentRoute,
  path: "/mesic/$month",
  component: MonthPage,
});

const indexRoute = createRoute({
  getParentRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/mesic/$month", params: { month: currentMonth() } });
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  monthRoute,
  createRoute({ getParentRoute, path: "/prehled", component: OverviewPage }),
  createRoute({ getParentRoute, path: "/sporeni", component: SavingsPage }),
  createRoute({ getParentRoute, path: "/polozky", component: ItemsPage }),
  createRoute({ getParentRoute, path: "/ucty", component: AccountsPage }),
  createRoute({
    getParentRoute,
    path: "/protistrany",
    component: CounterpartiesPage,
  }),
  createRoute({ getParentRoute, path: "/sablony", component: TemplatesPage }),
  createRoute({ getParentRoute, path: "/pojistky", component: InsurancePage }),
  createRoute({ getParentRoute, path: "/data", component: DataPage }),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

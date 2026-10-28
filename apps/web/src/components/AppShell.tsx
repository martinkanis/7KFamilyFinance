import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorMessage, Loading } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";
import { currentMonth } from "@/lib/format";
import { LoginPage } from "@/pages/LoginPage";

const NAV_LINKS = [
  { to: "/prehled", label: "Přehled" },
  { to: "/sporeni", label: "Spoření" },
  { to: "/polozky", label: "Položky" },
  { to: "/ucty", label: "Účty" },
  { to: "/protistrany", label: "Protistrany" },
  { to: "/sablony", label: "Šablony" },
  { to: "/pojistky", label: "Pojistky" },
  { to: "/data", label: "Excel" },
] as const;

const LINK_CLASS =
  "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900";
const ACTIVE_LINK_CLASS = "bg-brand-50 text-brand-700";

function Navigation({ username }: { username: string }) {
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => queryClient.clear(),
  });
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 font-semibold text-brand-700"
        >
          <img src="/favicon.svg" alt="" className="size-7" />
          <span className="hidden sm:inline">7KFamilyFinance</span>
        </Link>
        <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          <Link
            to="/mesic/$month"
            params={{ month: currentMonth() }}
            className={LINK_CLASS}
            activeProps={{ className: ACTIVE_LINK_CLASS }}
          >
            Měsíc
          </Link>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={LINK_CLASS}
              activeProps={{ className: ACTIVE_LINK_CLASS }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <span className="hidden text-sm text-slate-500 md:inline">
          {username}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => logout.mutate()}
          title="Odhlásit"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}

/** Bez platné session ukáže přihlášení; jinak navigaci a stránku. */
export function AppShell() {
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });

  if (me.isPending) {
    return <Loading />;
  }
  if (me.error instanceof ApiError && me.error.status === 401) {
    return <LoginPage />;
  }
  if (me.error) {
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorMessage error={me.error} />
      </div>
    );
  }
  return (
    <div className="min-h-screen">
      <Navigation username={me.data.username} />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookCopy,
  CalendarDays,
  ChartLine,
  FileSpreadsheet,
  Landmark,
  ListChecks,
  LogOut,
  Menu,
  PiggyBank,
  ShieldCheck,
  Users,
} from "lucide-react";
import { type ComponentType, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { currentMonth } from "@/lib/format";

type Icon = ComponentType<{ className?: string }>;

const PRIMARY_LINKS = [
  { to: "/prehled", label: "Přehled", icon: ChartLine },
  { to: "/sporeni", label: "Spoření", icon: PiggyBank },
] as const;

const MORE_LINKS = [
  { to: "/polozky", label: "Položky", icon: ListChecks },
  { to: "/ucty", label: "Účty", icon: Landmark },
  { to: "/protistrany", label: "Protistrany", icon: Users },
  { to: "/sablony", label: "Šablony", icon: BookCopy },
  { to: "/pojistky", label: "Pojistky", icon: ShieldCheck },
  { to: "/data", label: "Excel", icon: FileSpreadsheet },
] as const;

const TOP_LINK =
  "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900";
const TOP_LINK_ACTIVE = "bg-brand-50 text-brand-700";

function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => queryClient.clear(),
  });
}

function Brand() {
  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-2 font-semibold text-brand-700"
    >
      <img src="/favicon.svg" alt="" className="size-7" />
      <span>7KFamilyFinance</span>
    </Link>
  );
}

/** Horní lišta: na desktopu celá navigace, na telefonu jen logo. */
export function TopBar({ username }: { username: string }) {
  const logout = useLogout();
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
        <Brand />
        <nav className="hidden min-w-0 flex-1 gap-1 md:flex">
          <Link
            to="/mesic/$month"
            params={{ month: currentMonth() }}
            className={TOP_LINK}
            activeProps={{ className: TOP_LINK_ACTIVE }}
          >
            Měsíc
          </Link>
          {[...PRIMARY_LINKS, ...MORE_LINKS].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={TOP_LINK}
              activeProps={{ className: TOP_LINK_ACTIVE }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <span className="ml-auto hidden text-sm text-slate-500 md:inline">
          {username}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="hidden md:inline-flex"
          onClick={() => logout.mutate()}
          title="Odhlásit"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}

const TAB =
  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500";
const TAB_ACTIVE = "text-brand-700";

function TabContent({ icon: TabIcon, label }: { icon: Icon; label: string }) {
  return (
    <>
      <TabIcon className="size-6" />
      {label}
    </>
  );
}

function MoreSheet({
  username,
  onClose,
}: {
  username: string;
  onClose: () => void;
}) {
  const logout = useLogout();
  return (
    <Dialog open onClose={onClose} title="Další">
      <nav className="grid grid-cols-3 gap-2">
        {MORE_LINKS.map(({ to, label, icon: LinkIcon }) => (
          <Link
            key={to}
            to={to}
            onClick={onClose}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 px-2 py-4 text-sm font-medium text-slate-700 active:bg-slate-100"
            activeProps={{ className: "border-brand-500 bg-brand-50" }}
          >
            <LinkIcon className="size-6 text-brand-700" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
        <span className="text-sm text-slate-500">
          Přihlášen: <strong>{username}</strong>
        </span>
        <Button onClick={() => logout.mutate()}>
          <LogOut className="size-4" /> Odhlásit
        </Button>
      </div>
    </Dialog>
  );
}

/** Spodní lišta na telefonu – hlavní sekce na dosah palce, zbytek v „Další“. */
export function BottomBar({ username }: { username: string }) {
  const [isMoreOpen, setMoreOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isMoreActive = MORE_LINKS.some((link) => pathname.startsWith(link.to));
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <Link
          to="/mesic/$month"
          params={{ month: currentMonth() }}
          className={TAB}
          activeProps={{ className: TAB_ACTIVE }}
        >
          <TabContent icon={CalendarDays} label="Měsíc" />
        </Link>
        {PRIMARY_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={TAB}
            activeProps={{ className: TAB_ACTIVE }}
          >
            <TabContent icon={link.icon} label={link.label} />
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(TAB, isMoreActive && TAB_ACTIVE)}
        >
          <TabContent icon={Menu} label="Další" />
        </button>
      </nav>
      {isMoreOpen && (
        <MoreSheet username={username} onClose={() => setMoreOpen(false)} />
      )}
    </>
  );
}

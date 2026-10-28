import { useQuery } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import { BottomBar, TopBar } from "@/components/Navigation";
import { ErrorMessage, Loading } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";
import { LoginPage } from "@/pages/LoginPage";

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
      <TopBar username={me.data.username} />
      {/* Na telefonu místo pod obsahem pro spodní lištu. */}
      <main className="mx-auto max-w-7xl px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:py-6">
        <Outlet />
      </main>
      <BottomBar username={me.data.username} />
    </div>
  );
}

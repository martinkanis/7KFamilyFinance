import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApiError } from "@/lib/api";
import { router } from "@/router";
import "./index.css";

const MAX_RETRIES = 2;

function isClientError(error: unknown): boolean {
  return error instanceof ApiError && error.status < 500;
}

const ME_KEY = "me";

/** Vypršelá session kdekoli → znovu ověř přihlášení, AppShell ukáže login. */
function onUnauthorized(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    void queryClient.invalidateQueries({ queryKey: [ME_KEY] });
  }
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    // Chyba samotného „me“ už login ukazuje – invalidace by ho zacyklila.
    onError: (error, query) =>
      query.queryKey[0] !== ME_KEY && onUnauthorized(error),
  }),
  mutationCache: new MutationCache({ onError: onUnauthorized }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !isClientError(error) && count < MAX_RETRIES,
    },
  },
});

const root = document.getElementById("root");
if (!root) {
  throw new Error("Chybí element #root v index.html");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

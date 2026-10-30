import type {
  Account,
  AccountBalance,
  ApiErrorBody,
  BalanceInput,
  CategoryDelete,
  CategoryOrder,
  CategoryRef,
  CategoryRename,
  CategoryRenameResult,
  Counterparty,
  CurrentUser,
  ExcelBalanceAssignment,
  ExcelBalanceBlock,
  ImportResult,
  InsurancePolicy,
  Item,
  ItemEntryInput,
  ItemRename,
  ItemWithChanges,
  MonthCorrection,
  MonthView,
  OneOffInput,
  Overview,
  RowOrder,
  Settings,
  Template,
} from "@kkff/api/contracts";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    return body.error ?? `Požadavek selhal (${response.status})`;
  } catch {
    return `Požadavek selhal (${response.status})`;
  }
}

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers:
      body === undefined || isForm
        ? {}
        : { "content-type": "application/json" },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response));
  }
  return (await response.json()) as T;
}

/** Číselníky se stejným CRUD rozhraním. */
export interface Resources {
  accounts: Account;
  counterparties: Counterparty;
  templates: Template;
  insurance: InsurancePolicy;
  items: ItemWithChanges;
}

export type Resource = keyof Resources;
export type FieldValue = string | number | boolean | null;
export type Payload = Record<string, FieldValue>;

export const api = {
  me: () => request<CurrentUser>("GET", "/api/auth/me"),
  login: (username: string, password: string) =>
    request<CurrentUser>("POST", "/api/auth/login", { username, password }),
  logout: () => request<{ ok: boolean }>("POST", "/api/auth/logout"),

  list: <R extends Resource>(resource: R) =>
    request<Resources[R][]>("GET", `/api/${resource}`),
  create: <R extends Resource>(resource: R, payload: Payload) =>
    request<Resources[R]>("POST", `/api/${resource}`, payload),
  update: <R extends Resource>(resource: R, id: number, payload: Payload) =>
    request<Resources[R]>("PUT", `/api/${resource}/${id}`, payload),
  remove: (resource: Resource, id: number) =>
    request<{ id: number }>("DELETE", `/api/${resource}/${id}`),

  renameItem: (id: number, rename: ItemRename) =>
    request<Item>("PATCH", `/api/items/${id}`, rename),
  deleteItemChange: (itemId: number, changeId: number) =>
    request<ItemWithChanges>(
      "DELETE",
      `/api/items/${itemId}/changes/${changeId}`,
    ),
  addCategory: (category: CategoryRef) =>
    request<{ ok: boolean }>("POST", "/api/categories", category),
  orderCategories: (order: CategoryOrder) =>
    request<{ ok: boolean }>("PUT", "/api/categories/order", order),
  deleteCategory: (input: CategoryDelete) =>
    request<{ ok: boolean }>("POST", "/api/categories/delete", input),
  reorderRows: (month: string, order: RowOrder) =>
    request<MonthView>("PUT", `/api/months/${month}/order`, order),
  renameCategory: (rename: CategoryRename) =>
    request<CategoryRenameResult>("POST", "/api/items/rename-category", rename),

  month: (month: string) => request<MonthView>("GET", `/api/months/${month}`),
  saveItemEntry: (month: string, itemId: number, input: ItemEntryInput) =>
    request<MonthView>("PUT", `/api/months/${month}/items/${itemId}`, input),
  /** Pravidelná položka od tohoto měsíce končí (minulé měsíce zůstanou). */
  endItem: (month: string, itemId: number) =>
    request<MonthView>("DELETE", `/api/months/${month}/items/${itemId}`),
  /** Nová pravidelná platba (položka) platná od tohoto měsíce. */
  createRecurring: (month: string, input: OneOffInput) =>
    request<MonthView>("POST", `/api/months/${month}/items`, input),
  createOneOff: (month: string, input: OneOffInput) =>
    request<MonthView>("POST", `/api/months/${month}/one-offs`, input),
  updateOneOff: (month: string, id: number, input: OneOffInput) =>
    request<MonthView>("PUT", `/api/months/${month}/one-offs/${id}`, input),
  deleteOneOff: (month: string, id: number) =>
    request<MonthView>("DELETE", `/api/months/${month}/one-offs/${id}`),
  saveCorrection: (month: string, correction: MonthCorrection) =>
    request<MonthView>("PUT", `/api/months/${month}/correction`, correction),

  overview: () => request<Overview>("GET", "/api/overview"),
  balances: () => request<AccountBalance[]>("GET", "/api/balances"),
  saveBalances: (month: string, inputs: BalanceInput[]) =>
    request<AccountBalance[]>("PUT", `/api/balances/${month}`, inputs),
  previewExcelBalances: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<ExcelBalanceBlock[]>("POST", "/api/balances/excel", form);
  },
  applyExcelBalances: (month: string, assignments: ExcelBalanceAssignment[]) =>
    request<AccountBalance[]>(
      "PUT",
      `/api/balances/${month}/excel`,
      assignments,
    ),
  settings: () => request<Settings>("GET", "/api/settings"),
  saveSettings: (settings: Settings) =>
    request<Settings>("PUT", "/api/settings", settings),

  importExcel: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("confirm", "replace-all");
    return request<ImportResult>("POST", "/api/excel/import", form);
  },
  exportExcelUrl: "/api/excel/export",
};

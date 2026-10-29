import type {
  Account,
  Counterparty,
  Item,
  Template,
} from "@kkff/api/contracts";
import { useQuery } from "@tanstack/react-query";
import { type CrudConfig, CrudPage } from "@/components/crud/CrudPage";
import { operatingAccountsWith } from "@/lib/accounts";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";

interface Lookups {
  accounts: Account[];
  counterparties: Counterparty[];
  templates: Template[];
  items: Item[];
}

function amountLabel(item: Item, templates: Map<number, Template>): string {
  if (item.amountFromInsurance) {
    return "z pojistek";
  }
  if (item.amount != null) {
    return formatMoney(item.amount);
  }
  const template =
    item.templateId == null ? undefined : templates.get(item.templateId);
  return template?.amount != null
    ? `${formatMoney(template.amount)} (šablona)`
    : "–";
}

function scheduleLabel(item: Item): string {
  const day = item.dueDay ? `${item.dueDay}.` : "";
  const months = item.dueMonths ? `v měs. ${item.dueMonths}` : "každý měsíc";
  return [day, months].filter(Boolean).join(" ");
}

function itemsConfig(lookups: Lookups): CrudConfig<"items"> {
  const accountNames = new Map(lookups.accounts.map((a) => [a.id, a.name]));
  const counterpartyNames = new Map(
    lookups.counterparties.map((c) => [c.id, c.name]),
  );
  const templates = new Map(lookups.templates.map((t) => [t.id, t]));
  const categories = [...new Set(lookups.items.map((item) => item.category))];
  return {
    resource: "items",
    copySuffixKeys: ["code"],
    title: "Položky",
    singular: "Položka",
    accusative: "položku",
    description:
      "Pravidelné platby a příjmy – výchozí hodnoty pro všechny měsíce. Hodnoty z šablony se použijí, když je pole v položce prázdné.",
    searchText: (i: Item) =>
      `${i.code} ${i.name} ${i.category} ${i.note ?? ""}`,
    rowClassName: (i) => (i.active ? "" : "text-slate-400"),
    deleteWarning:
      "Zmizí ze všech měsíců včetně minulých a smaže se i historie zaplacení. Když platba jen končí, ukonči ji raději košem na stránce měsíce – minulé měsíce zůstanou.",
    defaults: { direction: "expense", active: true },
    columns: [
      {
        label: "ID",
        render: (i) => <span className="text-slate-500">{i.code}</span>,
      },
      {
        label: "Položka",
        render: (i) => <span className="font-medium">{i.name}</span>,
      },
      { label: "Kategorie", render: (i) => i.category },
      {
        label: "Částka",
        align: "right",
        render: (i) => amountLabel(i, templates),
      },
      { label: "Splatnost", render: scheduleLabel },
      {
        label: "Náš účet",
        render: (i) =>
          i.ourAccountId == null ? "" : accountNames.get(i.ourAccountId),
      },
      {
        label: "Protistrana",
        render: (i) =>
          i.counterpartyId == null
            ? ""
            : counterpartyNames.get(i.counterpartyId),
      },
      {
        label: "Šablona",
        render: (i) =>
          i.templateId == null ? "" : templates.get(i.templateId)?.code,
      },
    ],
    fields: [
      {
        key: "code",
        label: "ID",
        kind: "text",
        required: true,
        placeholder: "V57",
      },
      {
        key: "direction",
        label: "Směr",
        kind: "select",
        required: true,
        options: [
          { value: "expense", label: "Výdaj" },
          { value: "income", label: "Příjem" },
        ],
      },
      { key: "name", label: "Položka", kind: "text", required: true },
      {
        key: "category",
        label: "Kategorie",
        kind: "datalist",
        required: true,
        options: categories.map((category) => ({
          value: category,
          label: category,
        })),
      },
      {
        key: "amount",
        label: "Částka",
        kind: "money",
        hint: "Prázdné = částka ze šablony",
      },
      {
        key: "amountFromInsurance",
        label: "Částka = měsíční rezerva z pojistek",
        kind: "checkbox",
      },
      { key: "dueDay", label: "Den splatnosti", kind: "integer" },
      {
        key: "dueMonths",
        label: "Měsíce splatnosti",
        kind: "text",
        hint: "Prázdné = každý měsíc, jinak např. 3,9",
      },
      { key: "validFrom", label: "Platí od", kind: "date" },
      { key: "validTo", label: "Platí do", kind: "date" },
      {
        key: "ourAccountId",
        label: "Náš účet (z / na)",
        kind: "select",
        numericOptions: true,
        options: operatingAccountsWith(
          lookups.accounts,
          lookups.items.map((item) => item.ourAccountId),
        ).map((a) => ({ value: String(a.id), label: a.name })),
      },
      {
        key: "counterpartyId",
        label: "Protistrana",
        kind: "select",
        numericOptions: true,
        options: lookups.counterparties.map((c) => ({
          value: String(c.id),
          label: c.name,
        })),
      },
      {
        key: "templateId",
        label: "Šablona v bance",
        kind: "select",
        numericOptions: true,
        options: lookups.templates.map((t) => ({
          value: String(t.id),
          label: `${t.code} – ${t.name}`,
        })),
      },
      {
        key: "counterpartyAccount",
        label: "Účet protistrany",
        kind: "text",
        hint: "Prázdné = ze šablony / protistrany",
      },
      { key: "vs", label: "VS", kind: "text" },
      { key: "ks", label: "KS", kind: "text" },
      { key: "ss", label: "SS", kind: "text" },
      { key: "message", label: "Zpráva pro příjemce", kind: "text" },
      {
        key: "savings",
        label: "Do úspor (zůstává v majetku)",
        kind: "checkbox",
      },
      { key: "active", label: "Aktivní", kind: "checkbox" },
      { key: "sortOrder", label: "Pořadí", kind: "integer" },
      { key: "note", label: "Poznámka", kind: "textarea", wide: true },
    ],
  };
}

export function ItemsPage() {
  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.list("accounts"),
  });
  const counterparties = useQuery({
    queryKey: ["counterparties"],
    queryFn: () => api.list("counterparties"),
  });
  const templates = useQuery({
    queryKey: ["templates"],
    queryFn: () => api.list("templates"),
  });
  const items = useQuery({
    queryKey: ["items"],
    queryFn: () => api.list("items"),
  });
  const config = itemsConfig({
    accounts: accounts.data ?? [],
    counterparties: counterparties.data ?? [],
    templates: templates.data ?? [],
    items: items.data ?? [],
  });
  return <CrudPage config={config} />;
}

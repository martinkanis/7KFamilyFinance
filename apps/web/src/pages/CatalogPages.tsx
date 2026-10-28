import type {
  Account,
  Counterparty,
  InsurancePolicy,
  Template,
} from "@kkff/api/contracts";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { type CrudConfig, CrudPage } from "@/components/crud/CrudPage";
import type { Option } from "@/components/crud/fields";
import { api } from "@/lib/api";
import { formatMoney, safeUrl } from "@/lib/format";
import { resolveIban } from "@/lib/spd";

const OWNERS: Option[] = ["Já", "Eva", "Společné", "Děti"].map((owner) => ({
  value: owner,
  label: owner,
}));

const ACCOUNT_TYPES: Option[] = [
  "Běžný",
  "Spořicí",
  "Termínovaný",
  "Investice",
  "Penzijní",
  "Stavební spoření",
  "Hotovost",
].map((type) => ({ value: type, label: type }));

const yes = (value: boolean) => (value ? "✓" : "");

/** Upozorní na překlep v čísle účtu (stejná kontrola jako u QR plateb). */
function AccountNumber({ value }: { value: string | null }) {
  if (!value) {
    return null;
  }
  const check = resolveIban(value);
  return (
    <span
      className="font-mono text-xs"
      title={check.ok ? undefined : check.error}
    >
      {value}
      {!check.ok && <span className="ml-1 text-rose-600">⚠</span>}
    </span>
  );
}

function WebLink({ url }: { url: string | null }) {
  const safe = safeUrl(url);
  if (!safe) {
    return null;
  }
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className="inline-flex items-center gap-1 text-brand-600 hover:underline"
    >
      {new URL(safe).hostname} <ExternalLink className="size-3" />
    </a>
  );
}

const accountsConfig: CrudConfig<"accounts"> = {
  resource: "accounts",
  title: "Účty a spořicí instrumenty",
  singular: "Účet",
  description:
    "Počáteční stav všech účtů je startem přehledu majetku – zadává se jednou (datum počátku je v sekci Excel).",
  searchText: (a: Account) =>
    `${a.name} ${a.institution ?? ""} ${a.owner ?? ""} ${a.number ?? ""}`,
  columns: [
    {
      label: "Název",
      render: (a) => <span className="font-medium">{a.name}</span>,
    },
    { label: "Instituce", render: (a) => a.institution },
    { label: "Majitel", render: (a) => a.owner },
    { label: "Typ", render: (a) => a.type },
    { label: "Číslo účtu", render: (a) => <AccountNumber value={a.number} /> },
    {
      label: "Počáteční stav",
      align: "right",
      render: (a) => formatMoney(a.initialBalance),
    },
  ],
  defaults: { currency: "CZK", initialBalance: "0" },
  fields: [
    { key: "name", label: "Název", kind: "text", required: true },
    { key: "institution", label: "Instituce", kind: "text" },
    { key: "owner", label: "Majitel", kind: "select", options: OWNERS },
    { key: "type", label: "Typ", kind: "select", options: ACCOUNT_TYPES },
    {
      key: "number",
      label: "Číslo účtu",
      kind: "text",
      placeholder: "123456789/3030",
    },
    { key: "currency", label: "Měna", kind: "text", required: true },
    {
      key: "initialBalance",
      label: "Počáteční stav (Kč)",
      kind: "money",
      required: true,
    },
    { key: "sortOrder", label: "Pořadí", kind: "integer" },
    { key: "note", label: "Poznámka", kind: "textarea", wide: true },
  ],
};

const counterpartiesConfig: CrudConfig<"counterparties"> = {
  resource: "counterparties",
  title: "Protistrany",
  singular: "Protistrana",
  description:
    "Firmy, lidé a úřady, kterým platíme nebo od kterých dostáváme peníze.",
  searchText: (c: Counterparty) =>
    `${c.name} ${c.type ?? ""} ${c.accountNumber ?? ""} ${c.note ?? ""}`,
  columns: [
    {
      label: "Název",
      render: (c) => <span className="font-medium">{c.name}</span>,
    },
    { label: "Typ", render: (c) => c.type },
    { label: "Účet", render: (c) => <AccountNumber value={c.accountNumber} /> },
    { label: "Web", render: (c) => <WebLink url={c.web} /> },
    {
      label: "Poznámka",
      render: (c) => <span className="text-slate-500">{c.note}</span>,
    },
  ],
  fields: [
    { key: "name", label: "Název", kind: "text", required: true },
    {
      key: "type",
      label: "Typ",
      kind: "text",
      placeholder: "Energie, Pojišťovna, Nájemník…",
    },
    { key: "accountNumber", label: "Hlavní číslo účtu", kind: "text" },
    { key: "web", label: "Web", kind: "text", placeholder: "https://…" },
    { key: "contact", label: "Kontakt", kind: "text" },
    { key: "note", label: "Poznámka", kind: "textarea", wide: true },
  ],
};

const insuranceConfig: CrudConfig<"insurance"> = {
  resource: "insurance",
  title: "Pojistky",
  singular: "Pojistka",
  description:
    "Součet ročních pojistek / 12 je měsíční rezerva – položky s volbou „z pojistek“ ji platí každý měsíc.",
  searchText: (p: InsurancePolicy) => `${p.name} ${p.note ?? ""}`,
  columns: [
    {
      label: "Pojistka",
      render: (p) => <span className="font-medium">{p.name}</span>,
    },
    {
      label: "Roční částka",
      align: "right",
      render: (p) => formatMoney(p.annualAmount),
    },
    {
      label: "Měsíčně",
      align: "right",
      render: (p) => formatMoney(Math.round(p.annualAmount / 12)),
    },
    {
      label: "Poznámka",
      render: (p) => <span className="text-slate-500">{p.note}</span>,
    },
  ],
  fields: [
    { key: "name", label: "Pojistka", kind: "text", required: true },
    {
      key: "annualAmount",
      label: "Roční částka",
      kind: "money",
      required: true,
    },
    { key: "note", label: "Poznámka", kind: "textarea", wide: true },
  ],
};

function templatesConfig(
  counterparties: Counterparty[],
): CrudConfig<"templates"> {
  const names = new Map(counterparties.map((c) => [c.id, c.name]));
  return {
    resource: "templates",
    title: "Šablony plateb",
    singular: "Šablona",
    description:
      "Zrcadlo šablon v bankovnictví. Po kontrole čísla účtu proti bance zaškrtni „Ověřeno“.",
    searchText: (t: Template) =>
      `${t.code} ${t.name} ${t.accountNumber ?? ""} ${t.bankLogin ?? ""}`,
    rowClassName: (t) => (t.verified ? "" : "bg-amber-50/50"),
    columns: [
      {
        label: "ID",
        render: (t) => <span className="text-slate-500">{t.code}</span>,
      },
      {
        label: "Název",
        render: (t) => <span className="font-medium">{t.name}</span>,
      },
      { label: "Přihlášení", render: (t) => t.bankLogin },
      {
        label: "Protistrana",
        render: (t) =>
          t.counterpartyId == null ? null : names.get(t.counterpartyId),
      },
      {
        label: "Účet",
        render: (t) => <AccountNumber value={t.accountNumber} />,
      },
      { label: "VS", render: (t) => t.vs },
      {
        label: "Částka",
        align: "right",
        render: (t) => (t.amount == null ? "" : formatMoney(t.amount)),
      },
      { label: "Ověřeno", render: (t) => yes(t.verified) },
    ],
    fields: [
      {
        key: "code",
        label: "ID",
        kind: "text",
        required: true,
        placeholder: "E92",
      },
      { key: "name", label: "Název v bance", kind: "text", required: true },
      { key: "bankLogin", label: "Přihlášení v bance", kind: "text" },
      {
        key: "counterpartyId",
        label: "Protistrana",
        kind: "select",
        numericOptions: true,
        options: counterparties.map((c) => ({
          value: String(c.id),
          label: c.name,
        })),
      },
      { key: "accountNumber", label: "Účet příjemce", kind: "text" },
      { key: "amount", label: "Částka", kind: "money" },
      { key: "vs", label: "VS", kind: "text" },
      { key: "ks", label: "KS", kind: "text" },
      { key: "ss", label: "SS", kind: "text" },
      { key: "message", label: "Zpráva pro příjemce", kind: "text" },
      { key: "timesUsed", label: "Použito ×", kind: "integer" },
      { key: "knownAccount", label: "Známý účet", kind: "checkbox" },
      { key: "verified", label: "Ověřeno proti bance", kind: "checkbox" },
      { key: "note", label: "Poznámka", kind: "textarea", wide: true },
    ],
  };
}

export function AccountsPage() {
  return <CrudPage config={accountsConfig} />;
}

export function CounterpartiesPage() {
  return <CrudPage config={counterpartiesConfig} />;
}

export function InsurancePage() {
  return <CrudPage config={insuranceConfig} />;
}

export function TemplatesPage() {
  const counterparties = useQuery({
    queryKey: ["counterparties"],
    queryFn: () => api.list("counterparties"),
  });
  return <CrudPage config={templatesConfig(counterparties.data ?? [])} />;
}

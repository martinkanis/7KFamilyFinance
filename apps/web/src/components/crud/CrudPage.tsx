import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Search } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorMessage, Loading, PageHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import {
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/field";
import { api, type Resource, type Resources } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  emptyForm,
  type FieldDef,
  type FormValues,
  formFromRow,
  optionsFor,
  toPayload,
} from "./fields";

export interface ColumnDef<T> {
  label: string;
  render: (row: T) => ReactNode;
  align?: "right";
}

/** Samostatná tabulka na stránce (např. provozní × spořicí účty). */
export interface CrudSection<T> {
  title: string;
  description?: string;
  includes: (row: T) => boolean;
}

export interface CrudConfig<R extends Resource> {
  resource: R;
  title: string;
  singular: string;
  description?: ReactNode;
  columns: ColumnDef<Resources[R]>[];
  fields: FieldDef<Resources[R]>[];
  defaults?: FormValues;
  sections?: CrudSection<Resources[R]>[];
  /** Unikátní pole, kterým kopie dostane příponu „(kopie)“. */
  copySuffixKeys?: (keyof Resources[R] & string)[];
  searchText: (row: Resources[R]) => string;
  rowClassName?: (row: Resources[R]) => string;
}

interface Editing<T> {
  /** Mění se s každým otevřením, aby formulář začal s čerstvými hodnotami. */
  key: number;
  row: T | null;
  initial: FormValues;
}

const COPY_SUFFIX = " (kopie)";

function FieldControl<T>({
  field,
  values,
  onChange,
}: {
  field: FieldDef<T>;
  values: FormValues;
  onChange: (value: string | boolean) => void;
}) {
  const value = values[field.key] ?? "";
  if (field.kind === "checkbox") {
    return (
      <Checkbox
        label={field.label}
        checked={value === true}
        onChange={onChange}
      />
    );
  }
  const text = typeof value === "string" ? value : "";
  const options = optionsFor(field, values, text);
  const listId = `${field.key}-options`;
  return (
    <Field
      label={field.label}
      hint={field.hint}
      className={field.wide ? "sm:col-span-2" : undefined}
    >
      {field.kind === "textarea" && (
        <Textarea value={text} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.kind === "select" && (
        <Select value={text} onChange={(e) => onChange(e.target.value)}>
          {!field.required && <option value="">—</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      )}
      {field.kind === "datalist" && (
        <>
          <Input
            list={listId}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
          <datalist id={listId}>
            {options.map((option) => (
              <option key={option.value} value={option.value} />
            ))}
          </datalist>
        </>
      )}
      {["text", "money", "integer", "date"].includes(field.kind) && (
        <Input
          type={field.kind === "date" ? "date" : "text"}
          inputMode={
            field.kind === "money"
              ? "decimal"
              : field.kind === "integer"
                ? "numeric"
                : undefined
          }
          value={text}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

function copyOf<R extends Resource>(
  config: CrudConfig<R>,
  values: FormValues,
): FormValues {
  const copy = { ...values };
  for (const key of config.copySuffixKeys ?? []) {
    copy[key] = `${values[key] ?? ""}${COPY_SUFFIX}`;
  }
  return copy;
}

function EditDialog<R extends Resource>({
  config,
  editing,
  onCopy,
  onClose,
}: {
  config: CrudConfig<R>;
  editing: Editing<Resources[R]>;
  onCopy: (values: FormValues) => void;
  onClose: () => void;
}) {
  const { row } = editing;
  const queryClient = useQueryClient();
  const [values, setValues] = useState<FormValues>(editing.initial);
  const [formError, setFormError] = useState<string | null>(null);
  const onSuccess = () => {
    void queryClient.invalidateQueries();
    onClose();
  };
  const save = useMutation({
    mutationFn: (payload: Parameters<typeof api.create>[1]) =>
      row
        ? api.update(config.resource, row.id, payload)
        : api.create(config.resource, payload),
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.remove(config.resource, id),
    onSuccess,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = toPayload(config.fields, values);
    if (typeof payload === "string") {
      setFormError(payload);
      return;
    }
    setFormError(null);
    save.mutate(payload);
  };

  const confirmRemove = () => {
    if (
      row &&
      window.confirm(`Opravdu smazat ${config.singular.toLowerCase()}?`)
    ) {
      remove.mutate(row.id);
    }
  };

  const error = formError ? new Error(formError) : (save.error ?? remove.error);
  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={`${row ? "Upravit" : "Přidat"}: ${config.singular.toLowerCase()}`}
      footer={
        <>
          {row && (
            <Button
              variant="danger"
              onClick={confirmRemove}
              disabled={remove.isPending}
            >
              Smazat
            </Button>
          )}
          {row && (
            <Button
              onClick={() => onCopy(copyOf(config, values))}
              title="Otevře nový záznam se stejnými hodnotami"
            >
              <Copy className="size-4" /> Kopírovat
            </Button>
          )}
          <div className="flex-1" />
          <Button onClick={onClose}>Zrušit</Button>
          <Button
            variant="primary"
            type="submit"
            form="crud-form"
            disabled={save.isPending}
          >
            Uložit
          </Button>
        </>
      }
    >
      <form
        id="crud-form"
        onSubmit={submit}
        className="grid gap-4 sm:grid-cols-2"
      >
        {config.fields.map((field) => (
          <FieldControl
            key={field.key}
            field={field}
            values={values}
            onChange={(value) => setValues({ ...values, [field.key]: value })}
          />
        ))}
        {error && (
          <div className="sm:col-span-2">
            <ErrorMessage error={error} />
          </div>
        )}
      </form>
    </Dialog>
  );
}

/** Klik na řádek otevře úpravu – ne ale, když uživatel jen označuje text ke zkopírování. */
function isSelectingText(): boolean {
  return (window.getSelection()?.toString() ?? "") !== "";
}

function CrudTable<R extends Resource>({
  config,
  rows,
  onOpen,
}: {
  config: CrudConfig<R>;
  rows: Resources[R][];
  onOpen: (row: Resources[R]) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="bg-brand-700 text-left text-xs font-semibold tracking-wide text-white uppercase">
            {config.columns.map((column) => (
              <th
                key={column.label}
                className={cn(
                  "px-3 py-2.5",
                  column.align === "right" && "text-right",
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => !isSelectingText() && onOpen(row)}
              className={cn(
                "cursor-pointer border-t border-slate-100 hover:bg-brand-50",
                config.rowClassName?.(row),
              )}
            >
              {config.columns.map((column) => (
                <td
                  key={column.label}
                  className={cn(
                    "px-3 py-2 align-top",
                    column.align === "right" && "text-right tabular-nums",
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={config.columns.length}
                className="px-3 py-6 text-center text-slate-500"
              >
                Nic nenalezeno
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function CrudPage<R extends Resource>({
  config,
}: {
  config: CrudConfig<R>;
}) {
  const list = useQuery({
    queryKey: [config.resource],
    queryFn: () => api.list(config.resource),
  });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Editing<Resources[R]> | null>(null);

  const needle = search.trim().toLowerCase();
  const rows = (list.data ?? []).filter((row) =>
    config.searchText(row).toLowerCase().includes(needle),
  );
  const open = (row: Resources[R] | null, initial: FormValues) =>
    setEditing({ key: Date.now(), row, initial });
  const openRow = (row: Resources[R]) =>
    open(row, formFromRow(config.fields, row));

  return (
    <div>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <Button
            variant="primary"
            onClick={() =>
              open(null, emptyForm(config.fields, config.defaults))
            }
          >
            <Plus className="size-4" /> Přidat
          </Button>
        }
      />
      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute top-3 left-3 size-4 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Hledat…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {list.isPending && <Loading />}
      {list.error && <ErrorMessage error={list.error} />}
      {list.data && !config.sections && (
        <CrudTable config={config} rows={rows} onOpen={openRow} />
      )}
      {list.data &&
        config.sections?.map((section) => (
          <section key={section.title} className="mb-6">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            {section.description && (
              <p className="mb-2 text-sm text-slate-500">
                {section.description}
              </p>
            )}
            <CrudTable
              config={config}
              rows={rows.filter(section.includes)}
              onOpen={openRow}
            />
          </section>
        ))}
      {editing && (
        <EditDialog
          key={editing.key}
          config={config}
          editing={editing}
          onCopy={(values) => open(null, values)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

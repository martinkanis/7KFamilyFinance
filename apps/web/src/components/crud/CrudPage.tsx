import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Search } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorMessage, Loading, PageHeader } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
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
  /** 4. pád pro „Smazat …“ (položku, protistranu). */
  accusative: string;
  description?: ReactNode;
  columns: ColumnDef<Resources[R]>[];
  fields: FieldDef<Resources[R]>[];
  defaults?: FormValues;
  sections?: CrudSection<Resources[R]>[];
  /** Unikátní pole, kterým kopie dostane příponu „(kopie)“. */
  copySuffixKeys?: (keyof Resources[R] & string)[];
  searchText: (row: Resources[R]) => string;
  rowClassName?: (row: Resources[R]) => string;
  /** Co dalšího smazání způsobí – ukáže se v potvrzení. */
  deleteWarning?: string;
}

function confirmDelete<R extends Resource>(
  config: CrudConfig<R>,
  row: Resources[R],
): boolean {
  const question = `Opravdu smazat ${config.accusative} „${row.name}“?`;
  return window.confirm(
    config.deleteWarning ? `${question}\n\n${config.deleteWarning}` : question,
  );
}

function useRemove<R extends Resource>(
  config: CrudConfig<R>,
  onRemoved?: () => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.remove(config.resource, id),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onRemoved?.();
    },
  });
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
  const remove = useRemove(config, onClose);

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
    if (row && confirmDelete(config, row)) {
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

function isEmptyCell(content: ReactNode): boolean {
  return content == null || content === false || content === "";
}

/** Telefon: karta s prvním sloupcem jako nadpisem a ostatními jako popisky. */
interface RowsProps<R extends Resource> {
  config: CrudConfig<R>;
  rows: Resources[R][];
  onOpen: (row: Resources[R]) => void;
  onDelete: (row: Resources[R]) => void;
}

const deleteLabel = (accusative: string, row: { name: string }) =>
  `Smazat ${accusative} „${row.name}“`;

function CrudCards<R extends Resource>({
  config,
  rows,
  onOpen,
  onDelete,
}: RowsProps<R>) {
  const [titleColumn, ...detailColumns] = config.columns;
  if (rows.length === 0) {
    return (
      <p className="rounded-xl bg-white p-4 text-center text-sm text-slate-500 md:hidden">
        Nic nenalezeno
      </p>
    );
  }
  return (
    <ul className="space-y-2 md:hidden">
      {rows.map((row) => (
        <li key={row.id}>
          {/* biome-ignore lint/a11y/useSemanticElements: karta obsahuje odkazy a tlačítko kopírování, <button> je nesmí obalovat */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => !isSelectingText() && onOpen(row)}
            onKeyDown={(event) => event.key === "Enter" && onOpen(row)}
            className={cn(
              "w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm active:bg-brand-50",
              config.rowClassName?.(row),
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 font-medium">
                {titleColumn?.render(row)}
              </div>
              <div className="-mt-1 -mr-1 shrink-0">
                <DeleteButton
                  label={deleteLabel(config.accusative, row)}
                  onDelete={() => onDelete(row)}
                />
              </div>
            </div>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
              {detailColumns.map((column) => {
                const content = column.render(row);
                return isEmptyCell(content) ? null : (
                  <div key={column.label} className="contents">
                    <dt className="text-slate-500">{column.label}</dt>
                    <dd className="min-w-0 break-words">{content}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CrudTable<R extends Resource>(props: RowsProps<R>) {
  const { config, rows, onOpen, onDelete } = props;
  return (
    <>
      <CrudCards {...props} />
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full text-sm">
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
              <th className="w-12 px-3 py-2.5">
                <span className="sr-only">Smazat</span>
              </th>
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
                <td className="px-2 py-1 text-right align-top">
                  <DeleteButton
                    label={deleteLabel(config.accusative, row)}
                    onDelete={() => onDelete(row)}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={config.columns.length + 1}
                  className="px-3 py-6 text-center text-slate-500"
                >
                  Nic nenalezeno
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
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
  const remove = useRemove(config);

  const needle = search.trim().toLowerCase();
  const rows = (list.data ?? []).filter((row) =>
    config.searchText(row).toLowerCase().includes(needle),
  );
  const open = (row: Resources[R] | null, initial: FormValues) =>
    setEditing({ key: Date.now(), row, initial });
  const openRow = (row: Resources[R]) =>
    open(row, formFromRow(config.fields, row));
  const deleteRow = (row: Resources[R]) => {
    if (confirmDelete(config, row)) remove.mutate(row.id);
  };

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
      <div className="relative mb-3 sm:max-w-sm">
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
      {remove.error && (
        <div className="mb-3">
          <ErrorMessage error={remove.error} />
        </div>
      )}
      {list.data && !config.sections && (
        <CrudTable
          config={config}
          rows={rows}
          onOpen={openRow}
          onDelete={deleteRow}
        />
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
              onDelete={deleteRow}
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

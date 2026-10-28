import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
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
  toPayload,
} from "./fields";

export interface ColumnDef<T> {
  label: string;
  render: (row: T) => ReactNode;
  align?: "right";
}

export interface CrudConfig<R extends Resource> {
  resource: R;
  title: string;
  singular: string;
  description?: ReactNode;
  columns: ColumnDef<Resources[R]>[];
  fields: FieldDef<Resources[R]>[];
  defaults?: FormValues;
  searchText: (row: Resources[R]) => string;
  rowClassName?: (row: Resources[R]) => string;
}

function FieldControl<T>({
  field,
  value,
  onChange,
}: {
  field: FieldDef<T>;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
}) {
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
          {field.options?.map((option) => (
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
            {field.options?.map((option) => (
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

function EditDialog<R extends Resource>({
  config,
  row,
  onClose,
}: {
  config: CrudConfig<R>;
  row: Resources[R] | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<FormValues>(() =>
    row
      ? formFromRow(config.fields, row)
      : emptyForm(config.fields, config.defaults),
  );
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
            value={values[field.key] ?? ""}
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
  const [editing, setEditing] = useState<Resources[R] | "new" | null>(null);

  const needle = search.trim().toLowerCase();
  const rows = (list.data ?? []).filter((row) =>
    config.searchText(row).toLowerCase().includes(needle),
  );

  return (
    <div>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
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
      {list.data && (
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
                  onClick={() => setEditing(row)}
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
      )}
      {editing && (
        <EditDialog
          config={config}
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

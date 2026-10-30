import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";

/** Smazání kategorie s platbami: platby se přesunou do jiné kategorie. */
export function DeleteCategoryDialog({
  category,
  paymentCount,
  others,
  onConfirm,
  onClose,
}: {
  category: string;
  paymentCount: number;
  /** Ostatní kategorie stejného směru, kam jde platby přesunout. */
  others: string[];
  onConfirm: (moveTo: string) => void;
  onClose: () => void;
}) {
  const [moveTo, setMoveTo] = useState(others[0] ?? "");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (moveTo) onConfirm(moveTo);
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Smazat kategorii „${category}“`}
      footer={
        <>
          <div className="flex-1" />
          <Button onClick={onClose}>Zrušit</Button>
          <Button
            variant="danger"
            type="submit"
            form="delete-category-form"
            disabled={!moveTo}
          >
            Přesunout a smazat
          </Button>
        </>
      }
    >
      <form id="delete-category-form" onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-600">
          V kategorii jsou platby ({paymentCount} v tomto měsíci). Přesunou se
          ve všech měsících do vybrané kategorie.
        </p>
        {others.length === 0 ? (
          <p className="text-sm text-rose-700">
            Není kam je přesunout – nejdřív přidej jinou kategorii.
          </p>
        ) : (
          <Field label="Přesunout platby do">
            <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              {others.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </form>
    </Dialog>
  );
}

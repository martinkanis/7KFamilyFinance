import { Trash2 } from "lucide-react";
import { Button } from "./button";

/** Koš u řádku; klik se nepropíše do řádku (ten by otevřel úpravu). */
export function DeleteButton({
  label,
  disabled,
  onDelete,
}: {
  label: string;
  disabled?: boolean;
  onDelete: () => void;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onDelete();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className="text-slate-400 hover:bg-rose-50 hover:text-rose-600"
    >
      <Trash2 className="size-5 md:size-4" />
    </Button>
  );
}

import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { MonthRow } from "@kkff/api/contracts";
import { GripVertical } from "lucide-react";
import {
  createContext,
  type KeyboardEventHandler,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

// Přetahování plateb a kategorií na stránce měsíce: položí se před nebo za
// cíl podle toho, nad kterou jeho polovinou je tažený prvek.

export type DragData =
  | { type: "row"; row: MonthRow }
  | { type: "category"; category: string };

/** Cíl puštění: řádek (před/za), záhlaví kategorie (před/za; řádek jde na začátek). */
export interface DropTarget {
  id: string;
  data: DragData;
  after: boolean;
}

export const rowDndId = (row: MonthRow) => `row:${row.key}`;
export const categoryDndId = (category: string) => `cat:${category}`;

const DropContext = createContext<DropTarget | null>(null);
const DraggingContext = createContext<DragData | null>(null);

/** Tažení nezačne z polí a výběrů – v nich se píše, označuje a vybírá. */
function startsDrag(target: EventTarget | null): boolean {
  return !(
    target instanceof Element &&
    target.closest("input, textarea, select, [contenteditable='true']")
  );
}

// Myší jde řádek chytit kdekoli (kliknutí bez pohybu dál upravuje buňku),
// prstem po krátkém podržení – rychlý posun prstem dál roluje stránkou.
class RowMouseSensor extends MouseSensor {
  static activators = [
    {
      eventName: "onMouseDown" as const,
      handler: ({ nativeEvent }: { nativeEvent: MouseEvent }) =>
        nativeEvent.button === 0 && startsDrag(nativeEvent.target),
    },
  ];
}

class RowTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: "onTouchStart" as const,
      handler: ({ nativeEvent }: { nativeEvent: TouchEvent }) =>
        nativeEvent.touches.length === 1 && startsDrag(nativeEvent.target),
    },
  ];
}

// Při tažení kategorie se počítají jen záhlaví kategorií.
const collision: CollisionDetection = (args) => {
  const type = (args.active.data.current as DragData | undefined)?.type;
  const droppableContainers = args.droppableContainers.filter(
    (container) =>
      type === "row" ||
      (container.data.current as DragData | undefined)?.type === "category",
  );
  const filtered = { ...args, droppableContainers };
  const hits = pointerWithin(filtered);
  return hits.length > 0 ? hits : closestCenter(filtered);
};

function targetOf(event: DragMoveEvent | DragEndEvent): DropTarget | null {
  const { active, over } = event;
  if (!over || over.id === active.id) return null;
  const dragged = active.rect.current.translated;
  const middle = dragged ? dragged.top + dragged.height / 2 : 0;
  return {
    id: String(over.id),
    data: over.data.current as DragData,
    after: middle > over.rect.top + over.rect.height / 2,
  };
}

export function MonthDnd({
  children,
  onDrop,
}: {
  children: ReactNode;
  onDrop: (dragged: DragData, target: DropTarget) => void;
}) {
  const sensors = useSensors(
    useSensor(RowMouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(RowTouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );
  const [dragging, setDragging] = useState<DragData | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const reset = useCallback(() => {
    setDragging(null);
    setTarget(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={(event: DragStartEvent) =>
        setDragging(event.active.data.current as DragData)
      }
      onDragMove={(event) => setTarget(targetOf(event))}
      onDragEnd={(event) => {
        const dropTarget = targetOf(event);
        const dragged = event.active.data.current as DragData | undefined;
        reset();
        if (dragged && dropTarget) onDrop(dragged, dropTarget);
      }}
      onDragCancel={reset}
    >
      <DraggingContext.Provider value={dragging}>
        <DropContext.Provider value={target}>{children}</DropContext.Provider>
      </DraggingContext.Provider>
      <DragOverlay dropAnimation={null}>
        {dragging && <DragPreview data={dragging} />}
      </DragOverlay>
    </DndContext>
  );
}

function DragPreview({ data }: { data: DragData }) {
  return (
    <div className="flex cursor-grabbing items-center gap-2 rounded-lg border border-brand-500 bg-white px-3 py-2 text-sm font-medium shadow-lg">
      <GripVertical className="size-4 text-slate-400" />
      {data.type === "row" ? (
        <>
          <span className="truncate">{data.row.name}</span>
          <span className="ml-auto pl-3 tabular-nums">
            {formatMoney(data.row.amount)}
          </span>
        </>
      ) : (
        <span className="font-semibold text-brand-700">{data.category}</span>
      )}
    </div>
  );
}

/** Táhnutelný a zároveň cílový prvek (řádek platby nebo záhlaví kategorie). */
export function useDndItem(
  id: string,
  data: DragData,
  { dragDisabled }: { dragDisabled: boolean },
) {
  const draggable = useDraggable({ id, data, disabled: dragDisabled });
  const droppable = useDroppable({ id, data });
  const target = useContext(DropContext);
  const dragging = useContext(DraggingContext);
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      draggable.setNodeRef(node);
      droppable.setNodeRef(node);
    },
    [draggable.setNodeRef, droppable.setNodeRef],
  );
  const isTarget = target?.id === id;
  // Myš a dotyk na celém prvku, klávesnice jen na úchytu (Enter/mezerník
  // v poli uvnitř řádku nesmí spustit přetahování).
  const { onKeyDown, ...pointerListeners } = draggable.listeners ?? {};
  const onHandleKeyDown = onKeyDown as KeyboardEventHandler | undefined;
  return {
    setNodeRef,
    /** Na celý řádek/kartu/záhlaví. */
    listeners: pointerListeners,
    handle: { ...draggable.attributes, onKeyDown: onHandleKeyDown },
    isDragging: draggable.isDragging,
    /** Kam se puštěný prvek položí vzhledem k tomuto. */
    drop: !isTarget
      ? null
      : data.type === "category" && dragging?.type === "row"
        ? ("into" as const)
        : target.after
          ? ("after" as const)
          : ("before" as const),
  };
}

/** Úchyt pro přetažení (a pro klávesnici); táhnout jde i za celý řádek. */
export function DragHandle({
  label,
  handle,
  className,
  onEnable,
}: {
  label: string;
  handle: ReturnType<typeof useDndItem>["handle"];
  className?: string;
  /** Přetahování je vypnuté (seřazený seznam) – klik ho zapne. */
  onEnable?: () => void;
}) {
  if (onEnable) {
    const hint =
      "Seřazeno – klikni pro vlastní pořadí, pak jde platba přetáhnout";
    return (
      <button
        type="button"
        aria-label={hint}
        title={hint}
        onClick={onEnable}
        className={cn(
          "flex shrink-0 cursor-pointer items-center rounded text-slate-300 hover:bg-slate-100 hover:text-slate-500 focus-visible:outline-2 focus-visible:outline-brand-500",
          className,
        )}
      >
        <GripVertical className="size-5 md:size-4" />
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...handle}
      className={cn(
        "flex shrink-0 cursor-grab items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-brand-500 active:cursor-grabbing",
        className,
      )}
    >
      <GripVertical className="size-5 md:size-4" />
    </button>
  );
}

/** Čára, kam se tažený prvek položí (před/za cíl). */
export const DROP_LINE = {
  before: "shadow-[inset_0_3px_0_0_var(--color-brand-500)]",
  after: "shadow-[inset_0_-3px_0_0_var(--color-brand-500)]",
  into: "ring-2 ring-inset ring-brand-500",
} as const;

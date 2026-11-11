import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef } from "react";
import type { Field } from "../schema/schema";
import type { Action } from "./reducer";

type Props = {
  fields: Field[];
  selectedId: string | null;
  dispatch: (action: Action) => void;
};

export function Canvas({ fields, selectedId, dispatch }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const labelOf = (id: string | number) => fields.find((f) => f.id === id)?.label ?? String(id);
  const positionOf = (id: string | number) => fields.findIndex((f) => f.id === id) + 1;

  // Last position announced, so the pick-up message isn't immediately
  // replaced by a "moved" message for the spot the field started in.
  const lastOverId = useRef<string | number | null>(null);

  // Spoken by screen readers during keyboard and pointer drags.
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      lastOverId.current = active.id;
      return `Picked up ${labelOf(active.id)}, position ${positionOf(active.id)} of ${fields.length}.`;
    },
    onDragOver: ({ active, over }) => {
      if ((over?.id ?? null) === lastOverId.current) return undefined;
      lastOverId.current = over?.id ?? null;
      return over ? `${labelOf(active.id)} moved to position ${positionOf(over.id)} of ${fields.length}.` : `${labelOf(active.id)} is outside the list.`;
    },
    onDragEnd: ({ active, over }) =>
      over ? `${labelOf(active.id)} dropped at position ${positionOf(over.id)} of ${fields.length}.` : `${labelOf(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Move cancelled. ${labelOf(active.id)} is back at position ${positionOf(active.id)}.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    dispatch({ type: "move", from: positionOf(active.id) - 1, to: positionOf(over.id) - 1 });
  }

  if (fields.length === 0) {
    return <p className="canvas-empty">No fields yet. Add one from the list on the left.</p>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "To move a field, press space or enter on its handle, use the arrow keys to move it, then press space or enter again to drop it. Press escape to cancel.",
        },
      }}
    >
      <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
        <ol className="canvas" aria-label="Form fields">
          {fields.map((field) => (
            <SortableField
              key={field.id}
              field={field}
              selected={field.id === selectedId}
              onSelect={() => dispatch({ type: "select", id: field.id })}
              onRemove={() => dispatch({ type: "remove", id: field.id })}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableField({
  field,
  selected,
  onSelect,
  onRemove,
}: {
  field: Field;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });

  return (
    <li
      ref={setNodeRef}
      className={`canvas-item${selected ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="handle"
        aria-label={`Move ${field.label}`}
        {...attributes}
        {...listeners}
      >
        <span aria-hidden="true">⠿</span>
      </button>
      <button type="button" className="canvas-select" aria-pressed={selected} onClick={onSelect}>
        <span className="canvas-label">
          {field.label}
          {field.required && <span className="muted"> · required</span>}
        </span>
        <span className="canvas-meta">
          {field.type}
          {field.visibleWhen && " · conditional"}
        </span>
      </button>
      <button type="button" className="icon-button" aria-label={`Delete ${field.label}`} onClick={onRemove}>
        <span aria-hidden="true">×</span>
      </button>
    </li>
  );
}

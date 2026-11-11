import { SCHEMA_VERSION, type Field, type FieldType, type FormSchema } from "../schema/schema";

const HISTORY_LIMIT = 100;

export type BuilderState = {
  past: FormSchema[];
  present: FormSchema;
  future: FormSchema[];
  selectedId: string | null;
  // Set when an edit removed conditions so the schema stays valid.
  notice: string | null;
  // Consecutive edits to the same field property share one undo step.
  lastEditKey: string | null;
};

export type Action =
  | { type: "add"; fieldType: FieldType }
  | { type: "remove"; id: string }
  | { type: "move"; from: number; to: number }
  | { type: "update"; id: string; patch: Partial<Field> }
  | { type: "setTitle"; title: string }
  | { type: "replace"; schema: FormSchema }
  | { type: "select"; id: string | null }
  | { type: "undo" }
  | { type: "redo" };

export const emptySchema: FormSchema = { version: SCHEMA_VERSION, title: "Untitled form", fields: [] };

export function initialState(schema: FormSchema = emptySchema): BuilderState {
  return { past: [], present: schema, future: [], selectedId: null, notice: null, lastEditKey: null };
}

const LABELS: Record<FieldType, string> = {
  text: "Short answer",
  email: "Email",
  number: "Number",
  textarea: "Long answer",
  select: "Dropdown",
  checkbox: "Checkbox",
  date: "Date",
};

export function reducer(state: BuilderState, action: Action): BuilderState {
  switch (action.type) {
    case "select":
      return { ...state, selectedId: action.id, lastEditKey: null };

    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        ...state,
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        selectedId: keepSelection(previous, state.selectedId),
        notice: null,
        lastEditKey: null,
      };
    }

    case "redo": {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return {
        ...state,
        past: [...state.past, state.present],
        present: next,
        future: rest,
        selectedId: keepSelection(next, state.selectedId),
        notice: null,
        lastEditKey: null,
      };
    }

    case "add": {
      const id = nextId(state.present, action.fieldType);
      const field: Field = {
        id,
        type: action.fieldType,
        label: LABELS[action.fieldType],
        required: false,
        ...(action.fieldType === "select" ? { options: ["Option 1", "Option 2"] } : {}),
      };
      return commit(state, { ...state.present, fields: [...state.present.fields, field] }, { selectedId: id });
    }

    case "remove": {
      const fields = state.present.fields.filter((f) => f.id !== action.id);
      const { fields: cleaned, removed } = dropInvalidConditions(fields);
      return commit(state, { ...state.present, fields: cleaned }, {
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        notice: removed > 0 ? conditionsNotice(removed) : null,
      });
    }

    case "move": {
      const { from, to } = action;
      const fields = state.present.fields.slice();
      if (from === to || !fields[from] || to < 0 || to >= fields.length) return state;
      const [moved] = fields.splice(from, 1);
      fields.splice(to, 0, moved!);
      const { fields: cleaned, removed } = dropInvalidConditions(fields);
      return commit(state, { ...state.present, fields: cleaned }, {
        notice: removed > 0 ? conditionsNotice(removed) : null,
      });
    }

    case "update": {
      const index = state.present.fields.findIndex((f) => f.id === action.id);
      if (index === -1) return state;
      const current = state.present.fields[index]!;
      const updated = { ...current, ...action.patch };
      let fields = state.present.fields.map((f, i) => (i === index ? updated : f));

      // Renaming an id: point conditions at the new id instead of breaking them.
      if (action.patch.id && action.patch.id !== current.id) {
        const newId = action.patch.id;
        fields = fields.map((f) =>
          f.visibleWhen
            ? {
                ...f,
                visibleWhen: {
                  ...f.visibleWhen,
                  conditions: f.visibleWhen.conditions.map((c) =>
                    c.fieldId === current.id ? { ...c, fieldId: newId } : c,
                  ),
                },
              }
            : f,
        );
      }

      const editKey = `${action.id}:${Object.keys(action.patch).sort().join(",")}`;
      return commit(state, { ...state.present, fields }, {
        selectedId: action.patch.id ?? state.selectedId,
        editKey,
      });
    }

    case "setTitle":
      return commit(state, { ...state.present, title: action.title }, { editKey: "title" });

    case "replace":
      return commit(state, action.schema, { selectedId: null });
  }
}

function commit(
  state: BuilderState,
  present: FormSchema,
  extra: { selectedId?: string | null; notice?: string | null; editKey?: string } = {},
): BuilderState {
  const editKey = extra.editKey ?? null;
  const coalesce = editKey !== null && editKey === state.lastEditKey;
  return {
    past: coalesce ? state.past : [...state.past, state.present].slice(-HISTORY_LIMIT),
    present,
    future: [],
    selectedId: extra.selectedId === undefined ? state.selectedId : extra.selectedId,
    notice: extra.notice ?? null,
    lastEditKey: editKey,
  };
}

// Keeps only conditions that point at a field above their own field.
export function dropInvalidConditions(fields: Field[]): { fields: Field[]; removed: number } {
  const above = new Set<string>();
  let removed = 0;
  const out = fields.map((field) => {
    let result = field;
    if (field.visibleWhen) {
      const kept = field.visibleWhen.conditions.filter((c) => above.has(c.fieldId));
      removed += field.visibleWhen.conditions.length - kept.length;
      result =
        kept.length === field.visibleWhen.conditions.length
          ? field
          : kept.length === 0
            ? withoutVisibility(field)
            : { ...field, visibleWhen: { ...field.visibleWhen, conditions: kept } };
    }
    above.add(field.id);
    return result;
  });
  return { fields: out, removed };
}

function withoutVisibility(field: Field): Field {
  const { visibleWhen: _removed, ...rest } = field;
  return rest;
}

function conditionsNotice(count: number): string {
  return count === 1
    ? "Removed 1 condition that no longer pointed at an earlier field."
    : `Removed ${count} conditions that no longer pointed at an earlier field.`;
}

function nextId(schema: FormSchema, type: FieldType): string {
  const taken = new Set(schema.fields.map((f) => f.id));
  for (let n = 1; ; n++) {
    const id = `${type}_${n}`;
    if (!taken.has(id)) return id;
  }
}

function keepSelection(schema: FormSchema, id: string | null): string | null {
  return id && schema.fields.some((f) => f.id === id) ? id : null;
}

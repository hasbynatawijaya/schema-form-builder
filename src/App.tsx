import { useEffect, useReducer, useState } from "react";
import { Canvas } from "./builder/Canvas";
import { Inspector } from "./builder/Inspector";
import { JsonPanel } from "./builder/JsonPanel";
import { initialState, reducer } from "./builder/reducer";
import { sampleSchema } from "./builder/sample";
import { Tabs, type TabId } from "./builder/Tabs";
import { FormRenderer } from "./renderer/FormRenderer";
import { FIELD_TYPES, formSchema, type FieldType, type FormSchema, type FormValues } from "./schema/schema";

const STORAGE_KEY = "sfb:schema";

const ADD_LABELS: Record<FieldType, string> = {
  text: "Short answer",
  email: "Email",
  number: "Number",
  textarea: "Long answer",
  select: "Dropdown",
  checkbox: "Checkbox",
  date: "Date",
};

// The saved schema is a convenience. If storage is blocked or the data is
// stale, start from the sample instead.
function loadSaved(): FormSchema {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = formSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    }
  } catch {
    // ignore
  }
  return sampleSchema;
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(loadSaved()));
  const [tab, setTab] = useState<TabId>("build");
  const [submitted, setSubmitted] = useState<FormValues | null>(null);
  const { present: schema, selectedId, notice } = state;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
    } catch {
      // ignore
    }
  }, [schema]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      // Let text fields keep their own undo.
      if (target.closest("input, textarea, select")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selectedIndex = schema.fields.findIndex((f) => f.id === selectedId);
  const selected = selectedIndex >= 0 ? schema.fields[selectedIndex] : undefined;
  const issues = formSchema.safeParse(schema).error?.issues ?? [];

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="app-name">Form builder</h1>
        <label className="title-input">
          <span className="visually-hidden">Form title</span>
          <input value={schema.title} maxLength={120} onChange={(e) => dispatch({ type: "setTitle", title: e.target.value })} />
        </label>
        <div className="row">
          <button type="button" className="button" onClick={() => dispatch({ type: "undo" })} disabled={state.past.length === 0}>Undo</button>
          <button type="button" className="button" onClick={() => dispatch({ type: "redo" })} disabled={state.future.length === 0}>Redo</button>
        </div>
        <Tabs active={tab} onChange={setTab} />
      </header>

      <div role="status" aria-live="polite" className="notice">{notice}</div>
      {issues.length > 0 && (
        <div className="issues" role="alert">
          <p>This form can't be published yet:</p>
          <ul>{issues.map((i) => <li key={i.path.join(".") + i.message}>{i.message}</li>)}</ul>
        </div>
      )}

      <main>
        {tab === "build" && (
          <section id="panel-build" role="tabpanel" aria-labelledby="tab-build" className="build">
            <nav aria-label="Add a field" className="palette">
              <h2 className="panel-title">Add a field</h2>
              <ul>
                {FIELD_TYPES.map((type) => (
                  <li key={type}>
                    <button type="button" className="button button-block" onClick={() => dispatch({ type: "add", fieldType: type })}>
                      {ADD_LABELS[type]}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <section aria-label="Form fields" className="canvas-panel">
              <h2 className="panel-title">Fields</h2>
              <Canvas fields={schema.fields} selectedId={selectedId} dispatch={dispatch} />
            </section>
            <aside aria-label="Field settings" className="inspector-panel">
              {selected ? (
                <Inspector
                  field={selected}
                  earlierFields={schema.fields.slice(0, selectedIndex)}
                  allIds={schema.fields.map((f) => f.id)}
                  dispatch={dispatch}
                />
              ) : (
                <p className="muted">Select a field to edit it.</p>
              )}
            </aside>
          </section>
        )}

        {tab === "preview" && (
          <section id="panel-preview" role="tabpanel" aria-labelledby="tab-preview" className="preview">
            <FormRenderer key={JSON.stringify(schema)} schema={schema} onSubmit={setSubmitted} />
            {submitted && (
              <div className="submitted">
                <h2 className="panel-title">Submitted data</h2>
                <pre className="code">{JSON.stringify(submitted, null, 2)}</pre>
              </div>
            )}
          </section>
        )}

        {tab === "json" && (
          <section id="panel-json" role="tabpanel" aria-labelledby="tab-json">
            <JsonPanel schema={schema} onImport={(s) => dispatch({ type: "replace", schema: s })} />
          </section>
        )}
      </main>
    </div>
  );
}

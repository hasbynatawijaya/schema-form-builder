import { useState } from "react";
import { formSchema, type FormSchema } from "../schema/schema";

export function JsonPanel({ schema, onImport }: { schema: FormSchema; onImport: (schema: FormSchema) => void }) {
  const json = JSON.stringify(schema, null, 2);
  const [draft, setDraft] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [imported, setImported] = useState(false);

  function importDraft() {
    setImported(false);
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setErrors(["This is not valid JSON."]);
      return;
    }
    const result = formSchema.safeParse(parsed);
    if (!result.success) {
      setErrors(result.error.issues.map((i) => `${i.path.join(".") || "schema"}: ${i.message}`));
      return;
    }
    setErrors([]);
    setImported(true);
    onImport(result.data);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schema.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "form"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="json-panel">
      <section>
        <h2 className="panel-title">Schema</h2>
        <p className="muted">This JSON is what the renderer reads. Store it anywhere and pass it to the FormRenderer component.</p>
        <pre className="code" tabIndex={0} aria-label="Form schema JSON">{json}</pre>
        <div className="row">
          <button type="button" className="button" onClick={() => navigator.clipboard?.writeText(json)}>Copy</button>
          <button type="button" className="button" onClick={download}>Download</button>
        </div>
      </section>
      <section>
        <h2 className="panel-title">Import</h2>
        <label className="control">
          Paste a schema
          <textarea rows={10} value={draft} onChange={(e) => setDraft(e.target.value)} className="mono" />
        </label>
        <button type="button" className="button" onClick={importDraft} disabled={!draft.trim()}>Import</button>
        <div role="status" aria-live="polite">
          {imported && <p>Imported. Undo restores the previous form.</p>}
        </div>
        {errors.length > 0 && (
          <div role="alert" className="control-error">
            <p>The schema was not imported:</p>
            <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
      </section>
    </div>
  );
}

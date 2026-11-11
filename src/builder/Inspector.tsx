import { useState } from "react";
import { OPERATORS, type Condition, type Field, type Operator } from "../schema/schema";
import type { Action } from "./reducer";

const OPERATOR_LABELS: Record<Operator, string> = {
  equals: "equals",
  notEquals: "does not equal",
  contains: "contains",
  greaterThan: "is greater than",
  lessThan: "is less than",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
};

const ID_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

type Props = {
  field: Field;
  earlierFields: Field[];
  allIds: string[];
  dispatch: (action: Action) => void;
};

export function Inspector({ field, earlierFields, allIds, dispatch }: Props) {
  const update = (patch: Partial<Field>) => dispatch({ type: "update", id: field.id, patch });

  return (
    <div className="inspector">
      <h2 className="panel-title">Field settings</h2>

      {/* key resets the draft when another field is selected or the id changes */}
      <IdInput key={field.id} field={field} allIds={allIds} onCommit={(id) => update({ id })} />

      <label className="control">
        Label
        <input value={field.label} maxLength={120} onChange={(e) => update({ label: e.target.value })} />
      </label>

      <label className="control">
        Help text
        <input value={field.help ?? ""} maxLength={300} onChange={(e) => update({ help: e.target.value || undefined })} />
      </label>

      {field.type !== "checkbox" && field.type !== "select" && (
        <label className="control">
          Placeholder
          <input value={field.placeholder ?? ""} maxLength={120} onChange={(e) => update({ placeholder: e.target.value || undefined })} />
        </label>
      )}

      <label className="control control-inline">
        <input type="checkbox" checked={field.required} onChange={(e) => update({ required: e.target.checked })} />
        Required
      </label>

      {field.type === "select" && (
        <label className="control">
          Options, one per line
          <textarea
            rows={4}
            value={(field.options ?? []).join("\n")}
            onChange={(e) => update({ options: e.target.value.split("\n").map((o) => o.trim()).filter(Boolean) })}
          />
        </label>
      )}

      {(field.type === "number" || field.type === "text" || field.type === "textarea") && (
        <fieldset className="control-row">
          <legend>{field.type === "number" ? "Allowed range" : "Length in characters"}</legend>
          <NumberInput label="Min" value={field.min} onChange={(min) => update({ min })} />
          <NumberInput label="Max" value={field.max} onChange={(max) => update({ max })} />
        </fieldset>
      )}

      {(field.type === "text" || field.type === "textarea") && (
        <label className="control">
          Pattern (regular expression)
          <input value={field.pattern ?? ""} maxLength={200} onChange={(e) => update({ pattern: e.target.value || undefined })} />
        </label>
      )}

      <VisibilityEditor field={field} earlierFields={earlierFields} onChange={(visibleWhen) => update({ visibleWhen })} />
    </div>
  );
}

// Edits are kept locally until valid, so a half-typed id never reaches the schema.
function IdInput({ field, allIds, onCommit }: { field: Field; allIds: string[]; onCommit: (id: string) => void }) {
  const [draft, setDraft] = useState(field.id);

  const taken = draft !== field.id && allIds.includes(draft);
  const error = !ID_PATTERN.test(draft)
    ? "Lowercase letters, digits and _; start with a letter."
    : taken
      ? "Another field already uses this id."
      : null;

  return (
    <label className="control">
      Field id (key in submitted data)
      <input
        value={draft}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "id-error" : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => (error ? setDraft(field.id) : draft !== field.id && onCommit(draft))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !error && draft !== field.id) onCommit(draft);
        }}
      />
      {error && <span id="id-error" className="control-error">{error}</span>}
    </label>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <label className="control">
      {label}
      <input
        inputMode="decimal"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (raw === "") return onChange(undefined);
          const n = Number(raw);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
    </label>
  );
}

function VisibilityEditor({
  field,
  earlierFields,
  onChange,
}: {
  field: Field;
  earlierFields: Field[];
  onChange: (visibleWhen: Field["visibleWhen"]) => void;
}) {
  const rule = field.visibleWhen;

  if (earlierFields.length === 0) {
    return (
      <fieldset className="control-group">
        <legend>Show this field</legend>
        <p className="muted">Always. To make it conditional, add a field above it first.</p>
      </fieldset>
    );
  }

  const blank: Condition = { fieldId: earlierFields[earlierFields.length - 1]!.id, operator: "equals", value: "" };

  if (!rule) {
    return (
      <fieldset className="control-group">
        <legend>Show this field</legend>
        <p className="muted">Always.</p>
        <button type="button" className="button" onClick={() => onChange({ match: "all", conditions: [blank] })}>
          Show only when…
        </button>
      </fieldset>
    );
  }

  const setCondition = (index: number, patch: Partial<Condition>) =>
    onChange({ ...rule, conditions: rule.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)) });

  const removeCondition = (index: number) => {
    const conditions = rule.conditions.filter((_, i) => i !== index);
    onChange(conditions.length === 0 ? undefined : { ...rule, conditions });
  };

  return (
    <fieldset className="control-group">
      <legend>Show this field when</legend>
      <label className="control">
        Match
        <select value={rule.match} onChange={(e) => onChange({ ...rule, match: e.target.value as "all" | "any" })}>
          <option value="all">all conditions</option>
          <option value="any">any condition</option>
        </select>
      </label>

      <ol className="conditions">
        {rule.conditions.map((condition, index) => {
          const n = index + 1;
          const needsValue = condition.operator !== "isEmpty" && condition.operator !== "isNotEmpty";
          return (
            <li key={index} className="condition">
              <label className="control">
                <span className="visually-hidden">Condition {n} field</span>
                <select value={condition.fieldId} onChange={(e) => setCondition(index, { fieldId: e.target.value })}>
                  {earlierFields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </label>
              <label className="control">
                <span className="visually-hidden">Condition {n} operator</span>
                <select value={condition.operator} onChange={(e) => setCondition(index, { operator: e.target.value as Operator })}>
                  {OPERATORS.map((op) => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
                </select>
              </label>
              {needsValue && (
                <label className="control">
                  <span className="visually-hidden">Condition {n} value</span>
                  <input value={condition.value} placeholder="value" maxLength={200} onChange={(e) => setCondition(index, { value: e.target.value })} />
                </label>
              )}
              <button type="button" className="icon-button" aria-label={`Remove condition ${n}`} onClick={() => removeCondition(index)}>
                <span aria-hidden="true">×</span>
              </button>
            </li>
          );
        })}
      </ol>
      {rule.conditions.length < 10 && (
        <button type="button" className="button" onClick={() => onChange({ ...rule, conditions: [...rule.conditions, blank] })}>
          Add condition
        </button>
      )}
      <p className="muted">For a checkbox, compare with “true” or “false”.</p>
    </fieldset>
  );
}

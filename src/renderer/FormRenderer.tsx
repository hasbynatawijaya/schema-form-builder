import { useId, useMemo, useRef, useState } from "react";
import { visibleFieldIds } from "../schema/conditions";
import type { Field, FormSchema, FormValues } from "../schema/schema";
import { submittedValues, validate, type Errors } from "../schema/validate";

export type FormRendererProps = {
  schema: FormSchema;
  onSubmit: (values: FormValues) => void;
  submitLabel?: string;
};

export function FormRenderer({ schema, onSubmit, submitLabel = "Submit" }: FormRendererProps) {
  // Prefix ids so two forms on one page never share an element id.
  const prefix = useId();
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => visibleFieldIds(schema, values), [schema, values]);
  const domId = (fieldId: string) => `${prefix}-${fieldId}`;

  function change(fieldId: string, value: string | boolean) {
    const next = { ...values, [fieldId]: value };
    setValues(next);
    // After the first submit, keep errors in step with what the user types.
    if (attempted) setErrors(validate(schema, next));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    const found = validate(schema, values);
    setErrors(found);
    const firstInvalid = schema.fields.find((f) => found[f.id]);
    if (firstInvalid) {
      document.getElementById(domId(firstInvalid.id))?.focus();
      return;
    }
    onSubmit(submittedValues(schema, values));
  }

  const errorList = schema.fields.filter((f) => visible.has(f.id) && errors[f.id]);

  return (
    <form className="sfb-form" noValidate onSubmit={submit} aria-label={schema.title}>
      <h2 className="sfb-title">{schema.title}</h2>

      {errorList.length > 0 && (
        <div ref={summaryRef} className="sfb-summary" role="alert">
          <p>
            {errorList.length === 1 ? "There is 1 problem with this form:" : `There are ${errorList.length} problems with this form:`}
          </p>
          <ul>
            {errorList.map((f) => (
              <li key={f.id}>
                <a href={`#${domId(f.id)}`} onClick={(e) => { e.preventDefault(); document.getElementById(domId(f.id))?.focus(); }}>
                  {errors[f.id]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {schema.fields.map((field) =>
        visible.has(field.id) ? (
          <FieldControl
            key={field.id}
            field={field}
            id={domId(field.id)}
            value={values[field.id]}
            error={errors[field.id]}
            onChange={(v) => change(field.id, v)}
          />
        ) : null,
      )}

      <button type="submit" className="sfb-submit">{submitLabel}</button>
    </form>
  );
}

type FieldControlProps = {
  field: Field;
  id: string;
  value: string | boolean | undefined;
  error: string | undefined;
  onChange: (value: string | boolean) => void;
};

function FieldControl({ field, id, value, error, onChange }: FieldControlProps) {
  const helpId = field.help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    name: field.id,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
    "aria-required": field.required || undefined,
  } as const;

  const label = (
    <>
      {field.label}
      {field.required && <span className="sfb-required"> (required)</span>}
    </>
  );

  if (field.type === "checkbox") {
    return (
      <div className="sfb-field sfb-field-checkbox">
        <input {...common} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        <label htmlFor={id}>{label}</label>
        {field.help && <p id={helpId} className="sfb-help">{field.help}</p>}
        {error && <p id={errorId} className="sfb-error">{error}</p>}
      </div>
    );
  }

  const text = typeof value === "string" ? value : "";
  let control: React.ReactNode;
  switch (field.type) {
    case "textarea":
      control = <textarea {...common} rows={4} value={text} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "select":
      control = (
        <select {...common} value={text} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
      break;
    default:
      control = (
        <input
          {...common}
          type={field.type === "number" ? "text" : field.type}
          inputMode={field.type === "number" ? "decimal" : undefined}
          autoComplete={field.type === "email" ? "email" : undefined}
          value={text}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }

  return (
    <div className="sfb-field">
      <label htmlFor={id}>{label}</label>
      {field.help && <p id={helpId} className="sfb-help">{field.help}</p>}
      {error && <p id={errorId} className="sfb-error">{error}</p>}
      {control}
    </div>
  );
}

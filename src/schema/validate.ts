import { visibleFieldIds } from "./conditions";
import type { Field, FormSchema, FormValues } from "./schema";

export type Errors = Record<string, string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function checkField(field: Field, raw: string | boolean | undefined): string | null {
  if (field.type === "checkbox") {
    return field.required && raw !== true ? `${field.label} must be checked` : null;
  }

  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "") return field.required ? `${field.label} is required` : null;

  switch (field.type) {
    case "email":
      if (!EMAIL.test(value)) return `Enter a valid email address`;
      break;
    case "number": {
      const n = Number(value);
      if (Number.isNaN(n)) return `${field.label} must be a number`;
      if (field.min !== undefined && n < field.min) return `${field.label} must be at least ${field.min}`;
      if (field.max !== undefined && n > field.max) return `${field.label} must be at most ${field.max}`;
      break;
    }
    case "date":
      if (!DATE.test(value) || Number.isNaN(Date.parse(value))) return `Enter a date as YYYY-MM-DD`;
      break;
    case "select":
      if (!field.options?.includes(value)) return `Choose one of the options`;
      break;
    case "text":
    case "textarea":
      if (field.min !== undefined && value.length < field.min) return `${field.label} must be at least ${field.min} characters`;
      if (field.max !== undefined && value.length > field.max) return `${field.label} must be at most ${field.max} characters`;
      break;
  }

  if (field.pattern !== undefined && !new RegExp(field.pattern).test(value)) {
    return `${field.label} is not in the expected format`;
  }
  return null;
}

// Hidden fields are skipped: the user can't see them, so they can't fix them.
export function validate(schema: FormSchema, values: FormValues): Errors {
  const visible = visibleFieldIds(schema, values);
  const errors: Errors = {};
  for (const field of schema.fields) {
    if (!visible.has(field.id)) continue;
    const message = checkField(field, values[field.id]);
    if (message) errors[field.id] = message;
  }
  return errors;
}

// Only visible fields are submitted, so a value typed into a field that was
// later hidden never leaks into the result.
export function submittedValues(schema: FormSchema, values: FormValues): FormValues {
  const visible = visibleFieldIds(schema, values);
  const out: FormValues = {};
  for (const field of schema.fields) {
    if (!visible.has(field.id)) continue;
    out[field.id] = values[field.id] ?? (field.type === "checkbox" ? false : "");
  }
  return out;
}

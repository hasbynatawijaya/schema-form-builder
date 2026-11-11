import type { Condition, FormSchema, FormValues } from "./schema";

type Value = string | boolean | undefined;

function isEmpty(value: Value): boolean {
  return value === undefined || value === "" || value === false;
}

export function matches(condition: Condition, value: Value): boolean {
  const text = value === undefined ? "" : String(value);
  switch (condition.operator) {
    case "equals":
      return text === condition.value;
    case "notEquals":
      return text !== condition.value;
    case "contains":
      return text.toLowerCase().includes(condition.value.toLowerCase());
    case "greaterThan":
    case "lessThan": {
      if (isEmpty(value)) return false;
      const left = Number(text);
      const right = Number(condition.value);
      if (Number.isNaN(left) || Number.isNaN(right)) return false;
      return condition.operator === "greaterThan" ? left > right : left < right;
    }
    case "isEmpty":
      return isEmpty(value);
    case "isNotEmpty":
      return !isEmpty(value);
  }
}

// One top-to-bottom pass. Conditions may only reference earlier fields (the
// schema enforces it), and a hidden field counts as empty, so hiding a field
// also hides anything that depends on it.
export function visibleFieldIds(schema: FormSchema, values: FormValues): Set<string> {
  const visible = new Set<string>();
  for (const field of schema.fields) {
    const rule = field.visibleWhen;
    const valueOf = (id: string): Value => (visible.has(id) ? values[id] : undefined);
    const shown =
      !rule ||
      (rule.match === "all"
        ? rule.conditions.every((c) => matches(c, valueOf(c.fieldId)))
        : rule.conditions.some((c) => matches(c, valueOf(c.fieldId))));
    if (shown) visible.add(field.id);
  }
  return visible;
}

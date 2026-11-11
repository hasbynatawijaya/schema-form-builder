import { z } from "zod";

// The schema is the contract between the builder and the renderer. The builder
// only ever produces it; the renderer only ever reads it.

export const SCHEMA_VERSION = 1;

export const FIELD_TYPES = ["text", "email", "number", "textarea", "select", "checkbox", "date"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const OPERATORS = ["equals", "notEquals", "contains", "greaterThan", "lessThan", "isEmpty", "isNotEmpty"] as const;
export type Operator = (typeof OPERATORS)[number];

const fieldId = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "Use lowercase letters, digits and _; start with a letter");

export const conditionSchema = z.object({
  fieldId,
  operator: z.enum(OPERATORS),
  // Unused by isEmpty / isNotEmpty.
  value: z.string().max(200).default(""),
});
export type Condition = z.infer<typeof conditionSchema>;

export const visibilitySchema = z.object({
  match: z.enum(["all", "any"]),
  conditions: z.array(conditionSchema).min(1).max(10),
});
export type Visibility = z.infer<typeof visibilitySchema>;

export const fieldSchema = z.object({
  id: fieldId,
  type: z.enum(FIELD_TYPES),
  label: z.string().trim().min(1).max(120),
  help: z.string().max(300).optional(),
  required: z.boolean().default(false),
  placeholder: z.string().max(120).optional(),
  // select only
  options: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  // number: value range; text/textarea: length range
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().max(200).optional(),
  // Absent means always visible.
  visibleWhen: visibilitySchema.optional(),
});
export type Field = z.infer<typeof fieldSchema>;

export const formSchema = z
  .object({
    version: z.literal(SCHEMA_VERSION),
    title: z.string().trim().min(1).max(120),
    fields: z.array(fieldSchema).max(100),
  })
  .superRefine((form, ctx) => {
    const seen = new Set<string>();
    form.fields.forEach((field, index) => {
      if (seen.has(field.id)) {
        ctx.addIssue({ code: "custom", path: ["fields", index, "id"], message: `Duplicate field id "${field.id}"` });
      }
      // A condition may only look at fields above it. That keeps evaluation
      // a single top-to-bottom pass and rules out cycles.
      for (const condition of field.visibleWhen?.conditions ?? []) {
        if (!seen.has(condition.fieldId)) {
          ctx.addIssue({
            code: "custom",
            path: ["fields", index, "visibleWhen"],
            message: `"${field.label}" depends on "${condition.fieldId}", which is not an earlier field`,
          });
        }
      }
      if (field.type === "select" && (field.options?.length ?? 0) === 0) {
        ctx.addIssue({ code: "custom", path: ["fields", index, "options"], message: `"${field.label}" needs at least one option` });
      }
      if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
        ctx.addIssue({ code: "custom", path: ["fields", index, "min"], message: `"${field.label}": min is greater than max` });
      }
      if (field.pattern !== undefined) {
        try {
          new RegExp(field.pattern);
        } catch {
          ctx.addIssue({ code: "custom", path: ["fields", index, "pattern"], message: `"${field.label}": pattern is not a valid regular expression` });
        }
      }
      seen.add(field.id);
    });
  });
export type FormSchema = z.infer<typeof formSchema>;

export type FormValues = Record<string, string | boolean>;

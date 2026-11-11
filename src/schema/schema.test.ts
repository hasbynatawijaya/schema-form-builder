import { describe, expect, it } from "vitest";
import { visibleFieldIds, matches } from "./conditions";
import { formSchema, type FormSchema } from "./schema";
import { submittedValues, validate } from "./validate";

const trip: FormSchema = {
  version: 1,
  title: "Trip request",
  fields: [
    { id: "name", type: "text", label: "Name", required: true },
    { id: "travelling", type: "checkbox", label: "Travelling abroad", required: false },
    {
      id: "country",
      type: "select",
      label: "Country",
      required: true,
      options: ["Japan", "Singapore"],
      visibleWhen: { match: "all", conditions: [{ fieldId: "travelling", operator: "equals", value: "true" }] },
    },
    {
      id: "visa",
      type: "text",
      label: "Visa number",
      required: true,
      visibleWhen: { match: "all", conditions: [{ fieldId: "country", operator: "equals", value: "Japan" }] },
    },
    { id: "nights", type: "number", label: "Nights", required: false, min: 1, max: 30 },
  ],
};

describe("matches", () => {
  it("compares numbers numerically and never matches empty values", () => {
    expect(matches({ fieldId: "a", operator: "greaterThan", value: "9" }, "10")).toBe(true);
    expect(matches({ fieldId: "a", operator: "greaterThan", value: "9" }, "")).toBe(false);
    expect(matches({ fieldId: "a", operator: "lessThan", value: "x" }, "3")).toBe(false);
  });

  it("treats an unchecked checkbox as empty", () => {
    expect(matches({ fieldId: "a", operator: "isEmpty", value: "" }, false)).toBe(true);
    expect(matches({ fieldId: "a", operator: "isNotEmpty", value: "" }, true)).toBe(true);
  });

  it("matches contains without case sensitivity", () => {
    expect(matches({ fieldId: "a", operator: "contains", value: "TOKYO" }, "Trip to tokyo")).toBe(true);
  });
});

describe("visibleFieldIds", () => {
  it("shows a conditional field only when its condition holds", () => {
    expect(visibleFieldIds(trip, { travelling: false })).toEqual(new Set(["name", "travelling", "nights"]));
    expect(visibleFieldIds(trip, { travelling: true }).has("country")).toBe(true);
  });

  it("hides a dependent field when the field it depends on is hidden, even with a stale value", () => {
    // country still holds "Japan" from before, but travelling was unchecked.
    const visible = visibleFieldIds(trip, { travelling: false, country: "Japan" });
    expect(visible.has("country")).toBe(false);
    expect(visible.has("visa")).toBe(false);
  });

  it("supports any-of conditions", () => {
    const schema: FormSchema = {
      version: 1,
      title: "t",
      fields: [
        { id: "a", type: "text", label: "A", required: false },
        { id: "b", type: "text", label: "B", required: false },
        {
          id: "c",
          type: "text",
          label: "C",
          required: false,
          visibleWhen: {
            match: "any",
            conditions: [
              { fieldId: "a", operator: "equals", value: "x" },
              { fieldId: "b", operator: "equals", value: "y" },
            ],
          },
        },
      ],
    };
    expect(visibleFieldIds(schema, { a: "", b: "y" }).has("c")).toBe(true);
    expect(visibleFieldIds(schema, { a: "", b: "" }).has("c")).toBe(false);
  });
});

describe("validate", () => {
  it("does not validate required fields that are hidden", () => {
    const errors = validate(trip, { name: "Hasby", travelling: false });
    expect(errors).toEqual({});
  });

  it("validates fields once they become visible", () => {
    const errors = validate(trip, { name: "Hasby", travelling: true, country: "Japan" });
    expect(errors).toEqual({ visa: "Visa number is required" });
  });

  it("checks number ranges and formats", () => {
    expect(validate(trip, { name: "a", nights: "0" }).nights).toBe("Nights must be at least 1");
    expect(validate(trip, { name: "a", nights: "abc" }).nights).toBe("Nights must be a number");
  });

  it("rejects a select value that is not one of the options", () => {
    const errors = validate(trip, { name: "a", travelling: true, country: "Mars" });
    expect(errors.country).toBe("Choose one of the options");
  });
});

describe("submittedValues", () => {
  it("drops values typed into fields that are now hidden", () => {
    const out = submittedValues(trip, { name: "Hasby", travelling: false, country: "Japan", visa: "X1" });
    expect(out).toEqual({ name: "Hasby", travelling: false, nights: "" });
  });
});

describe("formSchema", () => {
  it("accepts a valid schema", () => {
    expect(formSchema.safeParse(trip).success).toBe(true);
  });

  it("rejects a condition that points at a later field", () => {
    const bad = { ...trip, fields: [trip.fields[3], ...trip.fields.filter((_, i) => i !== 3)] };
    const result = formSchema.safeParse(bad);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/not an earlier field/);
  });

  it("rejects duplicate ids, empty selects and invalid patterns", () => {
    const result = formSchema.safeParse({
      version: 1,
      title: "t",
      fields: [
        { id: "a", type: "text", label: "A", pattern: "([" },
        { id: "a", type: "select", label: "B", options: [] },
      ],
    });
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages).toEqual(
      expect.arrayContaining([
        '"A": pattern is not a valid regular expression',
        'Duplicate field id "a"',
        '"B" needs at least one option',
      ]),
    );
  });
});

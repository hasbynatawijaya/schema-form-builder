import type { FormSchema } from "../schema/schema";

export const sampleSchema: FormSchema = {
  version: 1,
  title: "Event registration",
  fields: [
    { id: "full_name", type: "text", label: "Full name", required: true },
    { id: "email", type: "email", label: "Work email", required: true, help: "We send the ticket here." },
    { id: "ticket", type: "select", label: "Ticket type", required: true, options: ["In person", "Online"] },
    {
      id: "dietary",
      type: "textarea",
      label: "Dietary needs",
      required: false,
      max: 300,
      visibleWhen: { match: "all", conditions: [{ fieldId: "ticket", operator: "equals", value: "In person" }] },
    },
    { id: "accessibility", type: "checkbox", label: "I need accessibility support", required: false },
    {
      id: "accessibility_details",
      type: "textarea",
      label: "What support do you need?",
      required: true,
      visibleWhen: { match: "all", conditions: [{ fieldId: "accessibility", operator: "equals", value: "true" }] },
    },
  ],
};

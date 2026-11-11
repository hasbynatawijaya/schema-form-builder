import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FormSchema } from "../schema/schema";
import { FormRenderer } from "./FormRenderer";

const schema: FormSchema = {
  version: 1,
  title: "Trip request",
  fields: [
    { id: "name", type: "text", label: "Name", required: true, help: "As on your passport" },
    { id: "abroad", type: "checkbox", label: "Travelling abroad", required: false },
    {
      id: "passport",
      type: "text",
      label: "Passport number",
      required: true,
      visibleWhen: { match: "all", conditions: [{ fieldId: "abroad", operator: "equals", value: "true" }] },
    },
  ],
};

describe("FormRenderer", () => {
  it("links help text to its input", () => {
    render(<FormRenderer schema={schema} onSubmit={() => {}} />);
    const input = screen.getByLabelText(/Name/);
    expect(input).toHaveAccessibleDescription("As on your passport");
  });

  it("shows a summary and focuses the first invalid field on submit", async () => {
    const onSubmit = vi.fn();
    render(<FormRenderer schema={schema} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByRole("alert")).toHaveTextContent("There is 1 problem with this form");
    const name = screen.getByLabelText(/Name/);
    expect(name).toHaveFocus();
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("As on your passport Name is required");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reveals a conditional field and validates it only when visible", async () => {
    const onSubmit = vi.fn();
    render(<FormRenderer schema={schema} onSubmit={onSubmit} />);
    expect(screen.queryByLabelText(/Passport number/)).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Name/), "Hasby");
    await userEvent.click(screen.getByLabelText("Travelling abroad"));
    expect(screen.getByLabelText(/Passport number/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByLabelText(/Passport number/)).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits only visible values", async () => {
    const onSubmit = vi.fn();
    render(<FormRenderer schema={schema} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/Name/), "Hasby");
    await userEvent.click(screen.getByLabelText("Travelling abroad"));
    await userEvent.type(screen.getByLabelText(/Passport number/), "A123");
    // Untick: the passport value must not be submitted.
    await userEvent.click(screen.getByLabelText("Travelling abroad"));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Hasby", abroad: false });
  });

  it("gives two forms on one page different element ids", () => {
    render(
      <>
        <FormRenderer schema={schema} onSubmit={() => {}} />
        <FormRenderer schema={schema} onSubmit={() => {}} />
      </>,
    );
    const [first, second] = screen.getAllByLabelText(/Name/);
    expect(first!.id).not.toBe(second!.id);
  });
});

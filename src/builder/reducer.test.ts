import { describe, expect, it } from "vitest";
import { initialState, reducer, type Action, type BuilderState } from "./reducer";

function run(actions: Action[], state: BuilderState = initialState()): BuilderState {
  return actions.reduce(reducer, state);
}

const withCondition = run([
  { type: "add", fieldType: "checkbox" },
  { type: "add", fieldType: "text" },
  {
    type: "update",
    id: "text_1",
    patch: { visibleWhen: { match: "all", conditions: [{ fieldId: "checkbox_1", operator: "equals", value: "true" }] } },
  },
]);

describe("reducer", () => {
  it("adds fields with unique ids and selects the new one", () => {
    const state = run([{ type: "add", fieldType: "text" }, { type: "add", fieldType: "text" }]);
    expect(state.present.fields.map((f) => f.id)).toEqual(["text_1", "text_2"]);
    expect(state.selectedId).toBe("text_2");
  });

  it("undoes and redoes", () => {
    const added = run([{ type: "add", fieldType: "email" }]);
    const undone = reducer(added, { type: "undo" });
    expect(undone.present.fields).toEqual([]);
    expect(undone.selectedId).toBeNull();
    const redone = reducer(undone, { type: "redo" });
    expect(redone.present.fields.map((f) => f.id)).toEqual(["email_1"]);
  });

  it("merges consecutive edits to the same property into one undo step", () => {
    const typed = run(
      ["S", "Sh", "Sho"].map((label) => ({ type: "update", id: "text_1", patch: { label } }) as Action),
      run([{ type: "add", fieldType: "text" }]),
    );
    expect(typed.present.fields[0]?.label).toBe("Sho");
    const undone = reducer(typed, { type: "undo" });
    expect(undone.present.fields[0]?.label).toBe("Short answer");
  });

  it("removes conditions that point at a deleted field and says so", () => {
    const state = reducer(withCondition, { type: "remove", id: "checkbox_1" });
    expect(state.present.fields).toHaveLength(1);
    expect(state.present.fields[0]?.visibleWhen).toBeUndefined();
    expect(state.notice).toMatch(/Removed 1 condition/);
  });

  it("removes a condition when its field moves above the field it depends on", () => {
    const state = reducer(withCondition, { type: "move", from: 1, to: 0 });
    expect(state.present.fields.map((f) => f.id)).toEqual(["text_1", "checkbox_1"]);
    expect(state.present.fields[0]?.visibleWhen).toBeUndefined();
    expect(state.notice).not.toBeNull();
  });

  it("keeps conditions working when the referenced field is renamed", () => {
    const state = reducer(withCondition, { type: "update", id: "checkbox_1", patch: { id: "abroad" } });
    expect(state.present.fields[1]?.visibleWhen?.conditions[0]?.fieldId).toBe("abroad");
  });

  it("clears the redo stack after a new edit", () => {
    const state = run([{ type: "undo" }, { type: "add", fieldType: "date" }], withCondition);
    expect(state.future).toEqual([]);
  });

  it("ignores an out-of-range move", () => {
    expect(reducer(withCondition, { type: "move", from: 0, to: 9 })).toBe(withCondition);
  });
});

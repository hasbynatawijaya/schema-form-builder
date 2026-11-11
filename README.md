# Schema Form Builder

A drag-and-drop form builder whose output is a JSON schema, plus a small renderer that turns that schema into an accessible form with conditional fields and validation.

The schema is the contract: the builder only writes it, the renderer only reads it. You can store the JSON anywhere and render it in any React app.

## Features

- Seven field types: short answer, email, number, long answer, dropdown, checkbox, date
- Conditional visibility: show a field when all or any conditions on earlier fields match
- Drag and drop with mouse or keyboard, with screen reader announcements
- Undo and redo (buttons, or Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z outside text fields)
- Live preview, JSON export and validated JSON import
- Saved in the browser between visits

## Design decisions

**Conditions may only point at earlier fields.** Visibility is then one top-to-bottom pass with no cycles to detect. When a delete or a move breaks that rule, the builder removes the broken condition and says so, instead of saving a schema the renderer can't evaluate.

**A hidden field counts as empty.** If A controls B and B controls C, hiding A also hides C, even when B still holds an old value.

**Hidden fields are not validated or submitted.** A user can't fix an error they can't see, and a value typed before a field was hidden never leaks into the result.

**Accessibility in the renderer:** every input has a label; help text and errors are linked with `aria-describedby`; invalid inputs get `aria-invalid`; on submit, an error summary appears and focus moves to the first invalid field. Ids are prefixed per form, so two forms can share a page.

## Use the renderer

```tsx
import { FormRenderer, formSchema } from "./dist-lib/renderer.js";
import "./dist-lib/renderer.css";

const schema = formSchema.parse(json); // reject anything that isn't a valid schema
<FormRenderer schema={schema} onSubmit={(values) => save(values)} />;
```

React and Zod are peer dependencies. Colours can be themed with CSS variables (`--sfb-accent`, `--sfb-danger`, `--sfb-border` and others in `src/renderer/renderer.css`).

## Measurements

Measured on a Mac with a local production build.

| Metric | Result |
|---|---|
| Renderer library (`npm run build:lib`), React and Zod excluded | 8.8 kB JS, 2.9 kB gzipped; CSS 0.6 kB gzipped |
| Full builder app bundle | 114 kB gzipped JS |
| axe violations (Build, Preview and JSON tabs, sample form) | 0 |
| Unit and component tests | 27 passing |
| Line coverage from unit tests | schema logic 89%, builder reducer 95%, renderer 84% |
| End-to-end tests (Playwright, Chromium) | 5 passing; the full suite passed 15 of 15 repeated runs |

The builder UI components are covered by the end-to-end tests, not by the line coverage numbers above.

## Run it

Needs Node 24.

```sh
npm install
npm run dev
```

Checks: `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`, `npm run build:lib`.

## Limits

- One page per form; no sections or multi-step forms yet.
- No file upload, radio group or multi-select fields yet.
- Checkbox conditions compare against the text "true" or "false".
- Saved forms live in this browser only.

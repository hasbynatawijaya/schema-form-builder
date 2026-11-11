import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function fieldLabels(page: Page) {
  return page.getByRole("list", { name: "Form fields" }).locator(".canvas-label").allInnerTexts();
}

test("has no detectable accessibility violations on any tab", async ({ page }) => {
  await page.goto("/");
  for (const tab of ["Build", "Preview", "JSON"]) {
    await page.getByRole("tab", { name: tab }).click();
    if (tab === "Build") await page.getByRole("button", { name: /^Work email/ }).click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, `${tab}: ${results.violations.map((v) => v.id).join(", ")}`).toEqual([]);
  }
});

test("reorders fields with the keyboard only", async ({ page }) => {
  await page.goto("/");
  expect((await fieldLabels(page)).slice(0, 2)).toEqual(["Full name · required", "Work email · required"]);

  // Each step waits for the screen reader announcement, which is also what a
  // keyboard user hears.
  const live = page.locator('[id^="DndLiveRegion"]');
  const handle = page.getByRole("button", { name: "Move Work email" });
  await handle.focus();
  await page.keyboard.press("Space");
  await expect(live).toHaveText("Picked up Work email, position 2 of 6.");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  // dnd-kit measures drop targets on the frames after pick-up; a key pressed
  // before that is ignored. People never press that fast, Playwright does.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.keyboard.press("ArrowUp");
  await expect(live).toContainText("position 1 of 6");
  await page.keyboard.press("Space");
  await expect(live).toContainText("dropped at position 1 of 6");

  await expect.poll(async () => (await fieldLabels(page))[0]).toBe("Work email · required");
  // Undo puts it back.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await fieldLabels(page))[0]).toBe("Full name · required");
});

test("preview shows conditional fields and focuses the first error", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Preview" }).click();

  await expect(page.getByLabel("Dietary needs")).toHaveCount(0);
  await page.getByLabel(/Ticket type/).selectOption("In person");
  await expect(page.getByLabel("Dietary needs")).toBeVisible();

  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("alert")).toContainText("There are 2 problems with this form");
  await expect(page.getByLabel(/Full name/)).toBeFocused();

  await page.getByLabel(/Full name/).fill("Ana");
  await page.getByLabel(/Work email/).fill("ana@example.com");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.locator(".submitted pre")).toContainText('"ticket": "In person"');
});

test("adds a field, edits it and keeps changes after a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Number" }).click();
  await page.getByLabel("Label").fill("Number of guests");
  await page.getByLabel("Max").fill("5");
  await expect(page.getByRole("button", { name: /^Number of guests/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: /^Number of guests/ })).toBeVisible();

  await page.getByRole("tab", { name: "Preview" }).click();
  await page.getByLabel("Number of guests").fill("9");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Number of guests must be at most 5").first()).toBeVisible();
});

test("refuses to import an invalid schema and explains why", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "JSON" }).click();
  await page.getByLabel("Paste a schema").fill(JSON.stringify({ version: 1, title: "x", fields: [{ id: "a", type: "select", label: "A", options: [] }] }));
  await page.getByRole("button", { name: "Import" }).click();
  await expect(page.getByRole("alert")).toContainText('"A" needs at least one option');
});

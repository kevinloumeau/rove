import { expect, test } from "@playwright/test";
import { seedPieces } from "./seed";

const run = Date.now().toString(36);
const top = `Filter tee ${run}`;
const bottom = `Filter skirt ${run}`;

test.beforeAll(async ({ request }) => {
  await seedPieces(request, [
    { name: top, category: "Tops", color: "Green", rgb: [67, 119, 76] },
    { name: bottom, category: "Bottoms", color: "Green", rgb: [40, 90, 50] },
  ]);
});

test("phone filter sheet narrows the closet and counts active filters", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "The filter sheet is the phone layout");
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search your closet" }).fill(run);
  await expect(page.getByText(top).first()).toBeVisible();
  // Tabs and buttons ignore taps until hydration, so retry the open.
  await expect(async () => {
    await page.getByRole("button", { name: "Filter and sort" }).click();
    await expect(page.locator(".filter-sheet")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.locator(".filter-sheet").getByText("Bottoms", { exact: true }).click();
  await page.getByRole("button", { name: /^Show \d+ pieces?$/ }).click();
  await expect(page.getByText(bottom).first()).toBeVisible();
  await expect(page.getByText(top)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Filter and sort, 1 active" })).toBeVisible();
});

test("the outfit card folds away and stays folded", async ({ page }) => {
  await page.goto("/");
  const fold = page.getByRole("button", { name: "Fold away outfit of the day" });
  await expect(async () => {
    await fold.click();
    await expect(page.getByRole("button", { name: /Outfit of the day/ })).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.reload();
  await expect(page.getByRole("button", { name: /Outfit of the day/ })).toBeVisible();
  await expect(fold).toHaveCount(0);
});

import { expect, test } from "@playwright/test";
import { seedPieces } from "./seed";

const run = Date.now().toString(36);
const name = `Wash knit ${run}`;

test.beforeAll(async ({ request }) => {
  await seedPieces(request, [{ name, category: "Tops", color: "Red", rgb: [190, 30, 40] }]);
});

test("a logged wear and the wash can both be undone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Uses the desktop details panel");
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search your closet" }).fill(run);
  const panel = page.getByRole("complementary", { name: "Selected item details" });
  await expect(async () => {
    await page.locator(".item-card", { hasText: name }).click();
    await expect(panel.getByRole("heading", { name })).toBeVisible({ timeout: 1000 });
  }).toPass();

  await panel.getByRole("button", { name: "Wore it today" }).click();
  await expect(panel.getByRole("button", { name: "Worn today" })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Wore it today" })).toBeVisible();
  await expect(panel).toContainText("Not yet");

  await panel.getByRole("button", { name: "Mark in wash" }).click();
  await expect(panel.getByRole("button", { name: "In the wash" })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await expect(panel.getByRole("button", { name: "Mark in wash" })).toBeVisible();
});

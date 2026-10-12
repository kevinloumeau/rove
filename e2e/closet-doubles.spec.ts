import { expect, test } from "@playwright/test";
import { seedPieces } from "./seed";

const run = Date.now().toString(36);
const twin = `Twin sweater ${run}`;

test.beforeAll(async ({ request }) => {
  // The same sweater added from two photos.
  await seedPieces(request, [{ name: twin, category: "Tops", color: "Gray", rgb: [128, 128, 128] }]);
  await seedPieces(request, [{ name: twin, category: "Tops", color: "Gray", rgb: [130, 128, 126] }]);
});

test("Insights offers to remove a piece added twice", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(twin).first()).toBeVisible();
  await expect(async () => {
    await page.getByRole("tab", { name: "Insights" }).click();
    await expect(page.getByRole("heading", { name: "Added twice?" })).toBeVisible({ timeout: 2000 });
  }).toPass();
  const pair = page.locator(".closet-doubles li", { hasText: twin });
  await expect(pair).toBeVisible();
  await pair.getByRole("button", { name: "Keep both" }).click();
  await expect(pair).toHaveCount(0);
});

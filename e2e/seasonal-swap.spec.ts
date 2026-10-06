import { expect, test } from "@playwright/test";
import { seedPieces } from "./seed";

const run = Date.now().toString(36);

test("seasonal swap packs away a summer piece, and it can be brought back", async ({ page, request }) => {
  const shorts = `Swap shorts ${run}`;
  await seedPieces(request, [
    { name: shorts, category: "Bottoms", color: "Tan", rgb: [205, 180, 140], season: "Summer" },
  ]);
  // October: fall now and winter next, so summer pieces are due to be packed away.
  await page.clock.setFixedTime(new Date("2026-10-06T12:00:00"));
  await page.goto("/");

  const card = page.getByRole("region", { name: "Seasonal swap" });
  const dialog = page.getByRole("dialog");
  // The card ignores clicks until the page has hydrated, so keep clicking until the dialog opens.
  await expect(async () => {
    await card.getByRole("button", { name: "Review" }).click();
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(dialog.getByRole("checkbox").first()).toBeVisible();
  await expect(dialog.getByText(shorts)).toBeVisible();
  await dialog.getByRole("button", { name: /^Swap \d+ pieces?$/ }).click();
  await expect(dialog).toBeHidden();

  const grid = page.locator(".wardrobe-grid");
  await expect(grid.getByText(shorts)).toHaveCount(0);
  await page
    .locator(".category-list")
    .getByRole("button", { name: /Stored/ })
    .click();
  await expect(page.getByRole("heading", { name: "Packed away" })).toBeVisible();
  await grid.getByText(shorts).click();
  await page.getByRole("button", { name: "Bring back" }).click();
  await expect(grid.getByText(shorts)).toHaveCount(0);

  // The swap is saved, so a reload shows the piece back in the closet.
  await page.reload();
  await expect(page.locator(".wardrobe-grid").getByText(shorts)).toBeVisible();
});

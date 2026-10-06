import { expect, test } from "@playwright/test";
import { seedPieces } from "./seed";

const run = Date.now().toString(36);
const first = `Swipe tee ${run}`;
const second = `Swipe knit ${run}`;

test.beforeAll(async ({ request }) => {
  await seedPieces(request, [
    { name: first, category: "Tops", color: "Green", rgb: [67, 119, 76] },
    { name: second, category: "Tops", color: "Pink", rgb: [230, 150, 170] },
  ]);
});

test("swipe a piece on the look to try the next one from that slot", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByText(first).first()).toBeVisible();
  await expect(async () => {
    await page.getByRole("tab", { name: "Outfits" }).click();
    await expect(page.getByRole("button", { name: "Choose top" })).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByRole("button", { name: "Choose top" }).click();
  const sheet = page.locator(".lb-sheet");
  if (await sheet.isVisible().catch(() => false)) {
    await sheet.getByRole("button", { name: first }).click();
    await expect(sheet).toBeHidden();
  } else {
    await page.locator(".lb-panel").getByRole("button", { name: first }).click();
  }
  await expect(page.getByRole("button", { name: `Top: ${first}` })).toBeVisible();

  // Pieces are listed newest first, so the knit sits just before the tee.
  if (testInfo.project.name === "phone") {
    await page
      .locator('.lb-slot[data-slot="Tops"] .lb-carousel')
      .evaluate((row) => row.scrollBy({ left: -(row.firstElementChild as HTMLElement).clientWidth - 4 }));
  } else {
    await page.locator('.lb-slot[data-slot="Tops"]').hover();
    await page.getByRole("button", { name: "Previous top" }).click();
  }
  await expect(page.getByRole("button", { name: `Top: ${second}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Remove ${second}` })).toBeVisible();
});

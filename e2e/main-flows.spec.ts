import { expect, test, type Page } from "@playwright/test";
import { seedPieces } from "./seed";

// Each run gets its own names, so the tests also pass against a local database that already has data.
const run = Date.now().toString(36);
const top = `Smoke tee ${run}`;
const bottom = `Smoke jeans ${run}`;

async function openTab(page: Page, name: string) {
  await page.getByRole("tab", { name }).click();
}

async function pickForSlot(page: Page, slot: string, piece: string) {
  await page.getByRole("button", { name: `Choose ${slot}` }).click();
  // Phones pick from a bottom sheet; wider screens pick from the side rail.
  const sheet = page.locator(".picker-sheet");
  if (await sheet.isVisible().catch(() => false)) {
    await sheet.getByRole("button", { name: piece }).click();
    await expect(sheet).toBeHidden();
  } else {
    await page.locator(".piece-rail").getByRole("button", { name: piece }).click();
  }
}

test.beforeAll(async ({ request }) => {
  await seedPieces(request, [
    { name: top, category: "Tops", color: "Blue", rgb: [62, 85, 240] },
    { name: bottom, category: "Bottoms", color: "Black", rgb: [22, 24, 21] },
  ]);
});

test("closet lists pieces and search narrows them", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(top).first()).toBeVisible();
  await page.getByRole("textbox", { name: "Search your closet" }).fill(`jeans ${run}`);
  await expect(page.getByText(bottom).first()).toBeVisible();
  await expect(page.getByText(top)).toHaveCount(0);
});

test("build a look, save it, and plan it for a day", async ({ page, request }) => {
  const lookCount = async () =>
    ((await (await request.get("/api/outfits")).json()) as { looks: unknown[] }).looks.length;
  const before = await lookCount();
  await page.goto("/");
  await expect(page.getByText(top).first()).toBeVisible();

  await openTab(page, "Outfits");
  await pickForSlot(page, "top", top);
  await pickForSlot(page, "bottom", bottom);
  await expect(page.getByRole("button", { name: `Top: ${top}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Bottom: ${bottom}` })).toBeVisible();
  await page.getByRole("button", { name: "Save this look" }).click();
  await expect.poll(lookCount).toBe(before + 1);

  await openTab(page, "Calendar");
  await page.getByRole("button", { name: /^(Plan this look|Replace planned look)$/ }).click();
  await expect(page.getByRole("button", { name: "Open look" })).toBeVisible();

  // The plan survives a reload.
  await page.reload();
  await openTab(page, "Calendar");
  await expect(page.getByRole("button", { name: "Open look" })).toBeVisible();
});

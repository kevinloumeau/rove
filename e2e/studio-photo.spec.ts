import { expect, test } from "@playwright/test";
import { seedPieces, studioShotPng } from "./seed";

const name = `Studio knit ${Date.now().toString(36)}`;

test.beforeAll(async ({ request }) => {
  await seedPieces(request, [{ name, category: "Tops", color: "Green", rgb: [67, 119, 76] }]);
});

test("make a studio photo, compare it, and keep it", async ({ page, request }) => {
  const imageOf = async () => {
    const { items } = (await (await request.get("/api/wardrobe")).json()) as {
      items: Array<{ name: string; image: string }>;
    };
    return items.find((item) => item.name === name)?.image;
  };
  const before = await imageOf();
  // Workers AI only runs on Cloudflare, so the generated photo is stubbed here.
  let sentImage = false;
  await page.route("**/api/wardrobe/studio", async (route) => {
    sentImage = (route.request().postData() ?? "").includes("image/jpeg");
    await route.fulfill({ contentType: "image/png", body: studioShotPng(256, [67, 119, 76]) });
  });

  await page.goto("/");
  // Tiles ignore clicks until the page has hydrated, so keep clicking until the details show.
  const studioButton = page.getByRole("button", { name: "Studio photo" }).filter({ visible: true });
  await expect(async () => {
    await page.getByText(name).first().click();
    await expect(studioButton).toBeVisible({ timeout: 1000 });
  }).toPass();
  await studioButton.click();

  const dialog = page.getByRole("dialog", { name: "Studio photo" });
  await expect(dialog.getByRole("img", { name: `Studio photo of ${name}` })).toBeVisible();
  expect(sentImage).toBe(true);
  await dialog.getByRole("button", { name: "Use studio photo" }).click();
  await expect(page.getByText("Studio photo saved")).toBeVisible();
  await expect.poll(imageOf).not.toBe(before);
});

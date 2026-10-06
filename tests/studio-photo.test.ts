import assert from "node:assert/strict";
import { test } from "node:test";
import {
  alphaBounds,
  base64ImageType,
  keyOutBackdrop,
  studioErrorMessage,
  studioErrorStatus,
  studioPrompt,
} from "../lib/studio-photo.ts";

/** A white studio photo with a navy square, which holds a white logo, and a soft gray shadow. */
function studioShot(size = 40) {
  const rgba = new Uint8ClampedArray(size * size * 4).fill(255);
  const paint = (x: number, y: number, color: [number, number, number]) => {
    const offset = (y * size + x) * 4;
    rgba[offset] = color[0];
    rgba[offset + 1] = color[1];
    rgba[offset + 2] = color[2];
  };
  for (let y = 10; y < 30; y += 1) for (let x = 10; x < 30; x += 1) paint(x, y, [20, 30, 80]);
  for (let y = 17; y < 23; y += 1) for (let x = 17; x < 23; x += 1) paint(x, y, [255, 255, 255]);
  for (let x = 10; x < 30; x += 1) paint(x, 31, [246, 246, 246]);
  return { rgba, size };
}

test("keyOutBackdrop clears the backdrop but keeps a white logo inside the garment", () => {
  const { rgba, size } = studioShot();
  const alpha = keyOutBackdrop(rgba, size, size);
  assert.equal(alpha[0], 0, "corner is backdrop");
  assert.equal(alpha[15 * size + 15], 255, "garment stays");
  assert.equal(alpha[20 * size + 20], 255, "white logo enclosed by the garment stays");
  assert.ok(alpha[31 * size + 20] < 128, "a faint shadow mostly fades away");
});

test("alphaBounds finds the garment", () => {
  const { rgba, size } = studioShot();
  const alpha = keyOutBackdrop(rgba, size, size);
  assert.deepEqual(alphaBounds(alpha, size, size), { x: 10, y: 10, width: 20, height: 20 });
  assert.equal(alphaBounds(new Uint8ClampedArray(16), 4, 4), null);
});

test("studioPrompt names the piece and poses it by category", () => {
  const prompt = studioPrompt("Navy cotton crew-neck sweater", "Tops");
  assert.match(prompt, /Navy cotton crew-neck sweater from image 0/);
  assert.match(prompt, /ghost mannequin/);
  assert.match(studioPrompt("White sneakers", "Shoes"), /three-quarter angle/);
  assert.match(studioPrompt("  ", "Other"), /the garment from image 0/);
});

test("pale pieces are shot on gray so the backdrop can be keyed out", () => {
  assert.match(studioPrompt("White tee", "Tops", "White"), /medium gray seamless background/);
  assert.match(studioPrompt("Cream knit", "Tops", "cream"), /medium gray/);
  assert.match(studioPrompt("Navy chinos", "Bottoms", "Navy"), /pure white seamless background/);
});

test("base64ImageType reads the image signature", () => {
  assert.equal(base64ImageType("/9j/4AAQ"), "image/jpeg");
  assert.equal(base64ImageType("iVBORw0KGgo"), "image/png");
  assert.equal(base64ImageType("UklGRiQA"), "image/webp");
  assert.equal(base64ImageType("hello"), null);
});

test("studioErrorMessage explains the daily free limit", () => {
  assert.match(
    studioErrorMessage(new Error("AiError: 4006: you have used up your daily free allocation")),
    /free studio photos are used up/,
  );
  assert.match(studioErrorMessage(new Error("3040: Capacity temporarily exceeded")), /busy/);
  assert.match(studioErrorMessage(null), /could not be made/);
});

test("studioErrorStatus separates used up and busy from other failures", () => {
  assert.equal(studioErrorStatus(new Error("AiError: 4006: you have used up your daily free allocation")), 429);
  assert.equal(studioErrorStatus(new Error("AiError: 3040: Capacity temporarily exceeded")), 503);
  assert.equal(studioErrorStatus(new Error("AiError: 5000: something else")), 502);
});

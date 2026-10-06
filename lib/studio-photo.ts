/**
 * Studio photos: Workers AI redraws a piece's cutout as a clean product shot on a white
 * backdrop, then the browser keys that backdrop out so the result is a transparent cutout like
 * every other piece. These helpers are shared by the API route, the browser and the tests.
 */

/** Cloudflare-hosted FLUX.2 [klein] 9B: image editing from a reference, about $0.017 a photo. */
export const STUDIO_MODEL = "@cf/black-forest-labs/flux-2-klein-9b";

/** The model only accepts reference images smaller than 512×512. */
export const STUDIO_INPUT_SIDE = 500;

/** Size of the generated photo. One megapixel is the model's base price. */
export const STUDIO_OUTPUT_SIDE = 1024;

const presentation: Record<string, string> = {
  Tops: "shown on an invisible ghost mannequin, front view, sleeves relaxed at the sides",
  Outerwear: "shown on an invisible ghost mannequin, front view, closed, sleeves relaxed at the sides",
  Dresses: "shown on an invisible ghost mannequin, front view, full length",
  Bottoms: "laid flat, front view, full length, neatly pressed",
  Shoes: "the pair side by side at a three-quarter angle, as in a shoe catalog",
  Accessories: "standing on its own, front view, as in a catalog",
};

/** Pieces this pale would melt into a white backdrop, so they are shot on gray instead. */
const paleColors = new Set(["white", "cream", "light gray"]);

/** The backdrop to ask for: one the browser can key out without eating into the piece. */
export function studioBackdrop(color: string) {
  return paleColors.has(color.trim().toLowerCase())
    ? "plain solid medium gray seamless background"
    : "pure white seamless background";
}

/** The editing prompt for one piece, from the closet item's name, category and color. */
export function studioPrompt(name: string, category: string, color = "") {
  const subject = name.trim().slice(0, 80) || "garment";
  const pose = presentation[category] ?? "shown on an invisible ghost mannequin, front view";
  return [
    `Professional e-commerce product photo of the ${subject} from image 0, ${pose}.`,
    "Keep exactly the same color, fabric texture, pattern, print, logos, buttons and stitching.",
    "Remove wrinkles, creases, and any person, body part, hanger or hair.",
    `Centered with even margins, soft diffused studio lighting with no cast shadow, ${studioBackdrop(color)}.`,
  ].join(" ");
}

/** Image type of a base64 string, read from its first bytes. */
export function base64ImageType(base64: string) {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBOR")) return "image/png";
  if (base64.startsWith("UklGR")) return "image/webp";
  return null;
}

/** A friendlier message for Workers AI failures that the user can do something about. */
export function studioErrorMessage(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  if (/4006|daily free allocation|neurons/i.test(text))
    return "Today's free studio photos are used up. They reset at midnight UTC, or turn on Workers Paid in Cloudflare for more.";
  if (/3040|capacity|429|rate/i.test(text)) return "The studio is busy right now. Try again in a minute.";
  return "The studio photo could not be made. Try again.";
}

/**
 * HTTP status for a Workers AI failure: 429 when today's free photos are used up, 503 when the
 * studio is busy, 502 otherwise. Automatic studio photos stop early on the first two.
 */
export function studioErrorStatus(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  if (/4006|daily free allocation|neurons/i.test(text)) return 429;
  if (/3040|capacity|429|rate/i.test(text)) return 503;
  return 502;
}

type Rgb = [number, number, number];

function colorDistance(rgba: Uint8ClampedArray, offset: number, color: Rgb) {
  return Math.hypot(rgba[offset] - color[0], rgba[offset + 1] - color[1], rgba[offset + 2] - color[2]);
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Median color of the image's outermost ring of pixels: the studio backdrop. */
export function borderColor(rgba: Uint8ClampedArray, width: number, height: number): Rgb {
  const samples: Rgb[] = [];
  const push = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    samples.push([rgba[offset], rgba[offset + 1], rgba[offset + 2]]);
  };
  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    push(0, y);
    push(width - 1, y);
  }
  return [0, 1, 2].map((channel) => {
    const values = samples.map((sample) => sample[channel]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  }) as Rgb;
}

/**
 * Alpha (0–255) that removes the plain backdrop around a studio photo. Only backdrop that is
 * connected to the image border is removed, so a white logo or collar inside the garment stays.
 * Pixels on the garment's edge fade by how far their color sits from the backdrop.
 */
export function keyOutBackdrop(rgba: Uint8ClampedArray, width: number, height: number, tolerance = 30) {
  const backdrop = borderColor(rgba, width, height);
  const background = new Uint8Array(width * height);
  const stack: number[] = [];
  const visit = (index: number) => {
    if (background[index] || colorDistance(rgba, index * 4, backdrop) >= tolerance) return;
    background[index] = 1;
    stack.push(index);
  };
  for (let x = 0; x < width; x += 1) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    visit(y * width);
    visit(y * width + width - 1);
  }
  while (stack.length) {
    const index = stack.pop()!;
    const x = index % width;
    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (index >= width) visit(index - width);
    if (index < width * (height - 1)) visit(index + width);
  }
  const alpha = new Uint8ClampedArray(width * height);
  for (let index = 0; index < alpha.length; index += 1) {
    alpha[index] = background[index]
      ? Math.round(smoothstep(tolerance * 0.5, tolerance, colorDistance(rgba, index * 4, backdrop)) * 255)
      : 255;
  }
  return alpha;
}

/** Bounding box of pixels with alpha above `threshold`, or null when nothing is left. */
export function alphaBounds(alpha: Uint8ClampedArray, width: number, height: number, threshold = 24) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alpha[y * width + x] <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

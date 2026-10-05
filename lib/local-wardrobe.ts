"use client";

import { CLOTHING_MODEL, MODEL_PROXY_PREFIX } from "./model-proxy";

type SegmentMask = { data: Uint8Array | Uint8ClampedArray; width: number; height: number; channels?: number };
type Segment = { label: string; mask: SegmentMask };
type LocalGarment = {
  name: string;
  category: string;
  color: string;
  season: string;
  description: string;
  tags: string[];
  image: Blob;
};

const garmentGroups: Array<{ labels: string[]; category: string; noun: string }> = [
  { labels: ["Upper-clothes"], category: "Tops", noun: "top" },
  { labels: ["Pants"], category: "Bottoms", noun: "trousers" },
  { labels: ["Skirt"], category: "Bottoms", noun: "skirt" },
  { labels: ["Dress"], category: "Dresses", noun: "dress" },
  { labels: ["Left-shoe", "Right-shoe"], category: "Shoes", noun: "shoes" },
  { labels: ["Bag"], category: "Accessories", noun: "bag" },
  { labels: ["Hat"], category: "Accessories", noun: "hat" },
  { labels: ["Belt"], category: "Accessories", noun: "belt" },
  { labels: ["Scarf"], category: "Accessories", noun: "scarf" },
  { labels: ["Sunglasses"], category: "Accessories", noun: "sunglasses" },
];

const colorPalette = [
  ["Black", 26, 27, 29],
  ["White", 235, 235, 230],
  ["Gray", 128, 130, 132],
  ["Navy", 31, 48, 79],
  ["Blue", 55, 102, 171],
  ["Red", 180, 45, 42],
  ["Pink", 219, 128, 153],
  ["Purple", 113, 76, 145],
  ["Green", 67, 119, 76],
  ["Yellow", 220, 187, 55],
  ["Orange", 210, 112, 43],
  ["Brown", 108, 72, 50],
  ["Beige", 201, 183, 145],
  ["Cream", 229, 218, 188],
] as const;

const extraSwatches: Record<string, string> = {
  Charcoal: "#36383a",
  Multicolor: "conic-gradient(#d0463b, #e0b23a, #4b8f5a, #3e6fc4, #d0463b)",
};

/** CSS background for a color name, falling back to a neutral when the name is unknown. */
export function colorSwatch(name: string) {
  const match = colorPalette.find((color) => color[0].toLowerCase() === name.trim().toLowerCase());
  if (match) return `rgb(${match[1]}, ${match[2]}, ${match[3]})`;
  return extraSwatches[name.trim()] ?? "#c9ccc4";
}

let segmenterPromise: Promise<(image: string) => Promise<Segment[]>> | null = null;

async function getSegmenter(onProgress: (message: string) => void) {
  if (!segmenterPromise) {
    onProgress("Downloading the private clothing model…");
    segmenterPromise = import("@huggingface/transformers").then(async ({ env, pipeline }) => {
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      // Load the model through this app's Worker rather than straight from huggingface.co.
      env.remoteHost = `${window.location.origin}${MODEL_PROXY_PREFIX}`;
      const model = await pipeline("image-segmentation", CLOTHING_MODEL, {
        dtype: "q8",
        progress_callback: (event: { status?: string; progress?: number }) => {
          if (event.status === "progress" && typeof event.progress === "number")
            onProgress(`Downloading the private clothing model… ${Math.round(event.progress)}%`);
        },
      });
      return model as unknown as (image: string) => Promise<Segment[]>;
    });
    // A failed download shouldn't stick: let the next photo try again.
    segmenterPromise = segmenterPromise.catch((error: unknown) => {
      segmenterPromise = null;
      console.error("Clothing model download failed", error);
      throw new Error("Rove couldn't download its clothing model. Check your connection and try again.");
    });
  } else {
    onProgress("Opening the cached clothing model…");
  }
  return segmenterPromise;
}

function maskValue(mask: SegmentMask, x: number, y: number) {
  const channels = mask.channels ?? Math.max(1, Math.round(mask.data.length / (mask.width * mask.height)));
  return mask.data[(y * mask.width + x) * channels] ?? 0;
}

function nearestColor(red: number, green: number, blue: number) {
  let best: (typeof colorPalette)[number] = colorPalette[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const color of colorPalette) {
    const distance = (red - color[1]) ** 2 + (green - color[2]) ** 2 + (blue - color[3]) ** 2;
    if (distance < bestDistance) {
      best = color;
      bestDistance = distance;
    }
  }
  return best[0];
}

async function cutoutFromMasks(bitmap: ImageBitmap, masks: SegmentMask[]) {
  const maskWidth = masks[0].width;
  const maskHeight = masks[0].height;
  const merged = new Uint8Array(maskWidth * maskHeight);
  let occupiedPixels = 0;
  let minX = maskWidth;
  let minY = maskHeight;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < maskHeight; y += 1) {
    for (let x = 0; x < maskWidth; x += 1) {
      let value = 0;
      for (const mask of masks) value = Math.max(value, maskValue(mask, x, y));
      merged[y * maskWidth + x] = value;
      if (value > 40) {
        occupiedPixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX || maxY < minY || occupiedPixels < Math.max(64, maskWidth * maskHeight * 0.0015)) return null;

  const scaleX = bitmap.width / maskWidth;
  const scaleY = bitmap.height / maskHeight;
  const paddingX = Math.max(8, Math.round((maxX - minX) * scaleX * 0.08));
  const paddingY = Math.max(8, Math.round((maxY - minY) * scaleY * 0.08));
  const cropX = Math.max(0, Math.floor(minX * scaleX) - paddingX);
  const cropY = Math.max(0, Math.floor(minY * scaleY) - paddingY);
  const cropRight = Math.min(bitmap.width, Math.ceil((maxX + 1) * scaleX) + paddingX);
  const cropBottom = Math.min(bitmap.height, Math.ceil((maxY + 1) * scaleY) + paddingY);
  const cropWidth = Math.max(1, cropRight - cropX);
  const cropHeight = Math.max(1, cropBottom - cropY);
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = cropWidth;
  cropCanvas.height = cropHeight;
  const cropContext = cropCanvas.getContext("2d", { willReadFrequently: true });
  if (!cropContext) return null;
  cropContext.drawImage(bitmap, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  const pixels = cropContext.getImageData(0, 0, cropWidth, cropHeight);
  let red = 0;
  let green = 0;
  let blue = 0;
  let samples = 0;
  for (let y = 0; y < cropHeight; y += 1) {
    const maskY = Math.min(maskHeight - 1, Math.max(0, Math.floor((y + cropY) / scaleY)));
    for (let x = 0; x < cropWidth; x += 1) {
      const maskX = Math.min(maskWidth - 1, Math.max(0, Math.floor((x + cropX) / scaleX)));
      const alpha = merged[maskY * maskWidth + maskX];
      const offset = (y * cropWidth + x) * 4;
      pixels.data[offset + 3] = alpha;
      if (alpha > 180 && x % 4 === 0 && y % 4 === 0) {
        red += pixels.data[offset];
        green += pixels.data[offset + 1];
        blue += pixels.data[offset + 2];
        samples += 1;
      }
    }
  }
  cropContext.putImageData(pixels, 0, 0);

  const side = Math.min(2048, Math.max(900, Math.max(cropWidth, cropHeight)));
  const output = document.createElement("canvas");
  output.width = side;
  output.height = side;
  const outputContext = output.getContext("2d");
  if (!outputContext) return null;
  const inset = Math.round(side * 0.08);
  const ratio = Math.min((side - inset * 2) / cropWidth, (side - inset * 2) / cropHeight, 1);
  const width = Math.round(cropWidth * ratio);
  const height = Math.round(cropHeight * ratio);
  outputContext.drawImage(cropCanvas, Math.round((side - width) / 2), Math.round((side - height) / 2), width, height);
  const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/png"));
  if (!blob) return null;
  const color = samples ? nearestColor(red / samples, green / samples, blue / samples) : "Multicolor";
  return { blob, color };
}

export async function processWardrobeImage(file: File, onProgress: (message: string) => void): Promise<LocalGarment[]> {
  const segmenter = await getSegmenter(onProgress);
  const sourceUrl = URL.createObjectURL(file);
  try {
    onProgress("Finding garments on this device…");
    const [segments, bitmap] = await Promise.all([segmenter(sourceUrl), createImageBitmap(file)]);
    const garments: LocalGarment[] = [];
    for (const group of garmentGroups) {
      const masks = segments.filter((segment) => group.labels.includes(segment.label)).map((segment) => segment.mask);
      if (!masks.length) continue;
      onProgress(`Cleaning ${group.noun} edges…`);
      const cutout = await cutoutFromMasks(bitmap, masks);
      if (!cutout) continue;
      garments.push({
        name: `${cutout.color} ${group.noun}`,
        category: group.category,
        color: cutout.color,
        season: "All season",
        description: `${cutout.color} ${group.noun} isolated privately on this device from the uploaded photo.`,
        tags: [group.category.toLowerCase(), group.noun, cutout.color.toLowerCase(), "local processing"],
        image: cutout.blob,
      });
      if (garments.length >= 8) break;
    }
    bitmap.close();
    if (!garments.length)
      throw new Error("No separate garments were found. Try a brighter photo with the clothing fully visible.");
    onProgress(`${garments.length} ${garments.length === 1 ? "piece" : "pieces"} ready—no paid API used.`);
    return garments;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

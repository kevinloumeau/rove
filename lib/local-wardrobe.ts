"use client";

import { colorName, colorSwatches } from "./color-name";
import { refineAlpha, removeSpecks } from "./cutout-refine";
import { keepRealGarments } from "./garment-filter";
import {
  type GarmentKind,
  type Guess,
  MATERIAL_TEMPLATE,
  PATTERN_TEMPLATE,
  TYPE_TEMPLATE,
  describeGarment,
  materialOptions,
  patternOptions,
  typeOptions,
} from "./garment-labels";
import { CLOTHING_MODEL, MODEL_PROXY_PREFIX, STYLE_MODEL } from "./model-proxy";

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

const garmentGroups: Array<{ labels: string[]; kind: GarmentKind; category: string; noun: string }> = [
  { labels: ["Upper-clothes"], kind: "top", category: "Tops", noun: "top" },
  { labels: ["Pants"], kind: "pants", category: "Bottoms", noun: "pants" },
  { labels: ["Skirt"], kind: "skirt", category: "Bottoms", noun: "skirt" },
  { labels: ["Dress"], kind: "dress", category: "Dresses", noun: "dress" },
  { labels: ["Left-shoe", "Right-shoe"], kind: "shoes", category: "Shoes", noun: "shoes" },
  { labels: ["Bag"], kind: "accessory", category: "Accessories", noun: "bag" },
  { labels: ["Hat"], kind: "accessory", category: "Accessories", noun: "hat" },
  { labels: ["Belt"], kind: "accessory", category: "Accessories", noun: "belt" },
  { labels: ["Scarf"], kind: "accessory", category: "Accessories", noun: "scarf" },
  { labels: ["Sunglasses"], kind: "accessory", category: "Accessories", noun: "sunglasses" },
];

/** CSS background for a color name, falling back to a neutral when the name is unknown. */
export function colorSwatch(name: string) {
  const key = Object.keys(colorSwatches).find((color) => color.toLowerCase() === name.trim().toLowerCase());
  return key ? colorSwatches[key] : "#c9ccc4";
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

type StyleClassifier = (image: string, labels: string[], options: { hypothesis_template: string }) => Promise<Guess[]>;
let styleModelPromise: Promise<StyleClassifier> | null = null;

/** Loads the style model that names each cutout. Its failure only costs the precise names. */
async function getStyleModel(onProgress: (message: string) => void) {
  if (!styleModelPromise) {
    onProgress("Downloading the private style model…");
    styleModelPromise = import("@huggingface/transformers").then(async ({ env, pipeline }) => {
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      env.remoteHost = `${window.location.origin}${MODEL_PROXY_PREFIX}`;
      const model = await pipeline("zero-shot-image-classification", STYLE_MODEL, {
        dtype: "q8",
        progress_callback: (event: { status?: string; progress?: number }) => {
          if (event.status === "progress" && typeof event.progress === "number")
            onProgress(`Downloading the private style model… ${Math.round(event.progress)}%`);
        },
      });
      return model as unknown as StyleClassifier;
    });
    styleModelPromise = styleModelPromise.catch((error: unknown) => {
      styleModelPromise = null;
      throw error;
    });
  }
  return styleModelPromise;
}

/** Asks the style model for the garment's type, fabric and pattern. Returns no guesses on failure. */
async function styleGuesses(kind: GarmentKind, preview: Blob | null, onProgress: (message: string) => void) {
  const types = typeOptions[kind];
  if (!preview || !types.length) return {};
  const url = URL.createObjectURL(preview);
  try {
    const classify = await getStyleModel(onProgress);
    const material =
      kind === "shoes"
        ? undefined
        : await classify(
            url,
            materialOptions.map((o) => o.label),
            { hypothesis_template: MATERIAL_TEMPLATE },
          );
    return {
      type: await classify(
        url,
        types.map((o) => o.label),
        { hypothesis_template: TYPE_TEMPLATE },
      ),
      material,
      pattern: await classify(
        url,
        patternOptions.map((o) => o.label),
        { hypothesis_template: PATTERN_TEMPLATE },
      ),
    };
  } catch (error) {
    console.warn("Style model unavailable; using plain names", error);
    return {};
  } finally {
    URL.revokeObjectURL(url);
  }
}

function maskValue(mask: SegmentMask, x: number, y: number) {
  const channels = mask.channels ?? Math.max(1, Math.round(mask.data.length / (mask.width * mask.height)));
  return mask.data[(y * mask.width + x) * channels] ?? 0;
}

/** Pixels a mask counts as covered, matching the threshold cutoutFromMasks uses. */
function maskArea(masks: SegmentMask[]) {
  const { width, height } = masks[0];
  let area = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (masks.some((mask) => maskValue(mask, x, y) > 40)) area += 1;
    }
  }
  return area;
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
  const cropMask = new Float32Array(cropWidth * cropHeight);
  for (let y = 0; y < cropHeight; y += 1) {
    const maskY = Math.min(maskHeight - 1, Math.max(0, Math.floor((y + cropY) / scaleY)));
    for (let x = 0; x < cropWidth; x += 1) {
      const maskX = Math.min(maskWidth - 1, Math.max(0, Math.floor((x + cropX) / scaleX)));
      cropMask[y * cropWidth + x] = merged[maskY * maskWidth + maskX] > 40 ? 1 : 0;
    }
  }
  const { alpha } = refineAlpha(pixels.data, cropMask, cropWidth, cropHeight);
  removeSpecks(alpha, cropWidth, cropHeight);
  let red = 0;
  let green = 0;
  let blue = 0;
  let samples = 0;
  for (let index = 0; index < alpha.length; index += 1) {
    const offset = index * 4;
    pixels.data[offset + 3] = alpha[index];
    if (alpha[index] > 180 && index % 3 === 0) {
      red += pixels.data[offset];
      green += pixels.data[offset + 1];
      blue += pixels.data[offset + 2];
      samples += 1;
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
  const color = samples ? colorName(red / samples, green / samples, blue / samples) : "Multicolor";

  // The style model reads a small copy on white, since transparent pixels would turn black.
  const preview = document.createElement("canvas");
  preview.width = 336;
  preview.height = 336;
  const previewContext = preview.getContext("2d");
  if (!previewContext) return { blob, color, preview: null };
  previewContext.fillStyle = "#ffffff";
  previewContext.fillRect(0, 0, preview.width, preview.height);
  previewContext.drawImage(output, 0, 0, preview.width, preview.height);
  const previewBlob = await new Promise<Blob | null>((resolve) => preview.toBlob(resolve, "image/jpeg", 0.9));
  return { blob, color, preview: previewBlob };
}

export async function processWardrobeImage(file: File, onProgress: (message: string) => void): Promise<LocalGarment[]> {
  const segmenter = await getSegmenter(onProgress);
  const sourceUrl = URL.createObjectURL(file);
  try {
    onProgress("Finding garments on this device…");
    const [segments, bitmap] = await Promise.all([segmenter(sourceUrl), createImageBitmap(file)]);
    const found = garmentGroups.flatMap((group) => {
      const masks = segments.filter((segment) => group.labels.includes(segment.label)).map((segment) => segment.mask);
      const small = group.category === "Shoes" || group.category === "Accessories";
      return masks.length ? [{ group, masks, small, area: maskArea(masks) }] : [];
    });
    const totalPixels = found.length ? found[0].masks[0].width * found[0].masks[0].height : 0;
    const garments: LocalGarment[] = [];
    for (const { group, masks } of keepRealGarments(found, totalPixels)) {
      onProgress(`Cleaning ${group.noun} edges…`);
      const cutout = await cutoutFromMasks(bitmap, masks);
      if (!cutout) continue;
      onProgress(`Naming the ${group.noun}…`);
      const guesses = await styleGuesses(group.kind, cutout.preview, onProgress);
      const details = describeGarment({
        kind: group.kind,
        fallbackNoun: group.noun,
        fallbackCategory: group.category,
        color: cutout.color,
        ...guesses,
      });
      garments.push({ ...details, color: cutout.color, image: cutout.blob });
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

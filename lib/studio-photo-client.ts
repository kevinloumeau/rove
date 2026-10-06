"use client";

import { removeSpecks } from "./cutout-refine";
import { STUDIO_INPUT_SIDE, alphaBounds, keyOutBackdrop } from "./studio-photo";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That photo could not be opened."));
    image.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The photo could not be exported."))),
      type,
      quality,
    ),
  );
}

/** The piece's cutout on white, small enough for the studio model, as a JPEG. */
export async function studioInput(imageUrl: string) {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = STUDIO_INPUT_SIDE;
  canvas.height = STUDIO_INPUT_SIDE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't prepare the photo.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  return toBlob(canvas, "image/jpeg", 0.92);
}

/**
 * Turns the generated studio photo into a transparent cutout framed like the others: square,
 * centered, with an 8% margin.
 */
export async function studioCutout(photo: Blob) {
  const url = URL.createObjectURL(photo);
  try {
    const image = await loadImage(url);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const source = document.createElement("canvas");
    source.width = width;
    source.height = height;
    const context = source.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This browser can't prepare the photo.");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, width, height);
    const alpha = keyOutBackdrop(pixels.data, width, height);
    removeSpecks(alpha, width, height);
    for (let index = 0; index < alpha.length; index += 1) pixels.data[index * 4 + 3] = alpha[index];
    context.putImageData(pixels, 0, 0);
    const bounds = alphaBounds(alpha, width, height);
    if (!bounds) throw new Error("The studio photo came back empty. Try again.");

    const side = Math.max(width, height);
    const inset = Math.round(side * 0.08);
    const ratio = Math.min((side - inset * 2) / bounds.width, (side - inset * 2) / bounds.height);
    const output = document.createElement("canvas");
    output.width = side;
    output.height = side;
    const outputContext = output.getContext("2d");
    if (!outputContext) throw new Error("This browser can't prepare the photo.");
    const drawWidth = Math.round(bounds.width * ratio);
    const drawHeight = Math.round(bounds.height * ratio);
    outputContext.drawImage(
      source,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      Math.round((side - drawWidth) / 2),
      Math.round((side - drawHeight) / 2),
      drawWidth,
      drawHeight,
    );
    return toBlob(output, "image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

"use client";

import { differenceHash } from "./photo-hash";

const MAX_SIDE = 2048;

/**
 * Returns a copy of the photo no larger than 2048px on its longest side, as a JPEG. Photos that
 * are already small are returned unchanged. Garment cutouts are capped at 2048px anyway, so the
 * extra resolution of a phone photo only slows segmentation and the upload.
 */
export async function shrinkPhoto(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= MAX_SIDE && file.size <= 3 * 1024 * 1024) return file;
    const scale = Math.min(1, MAX_SIDE / longest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    // JPEG has no transparency; keep transparent PNG backgrounds white rather than black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

/** 64-bit difference hash of the photo (see lib/photo-hash.ts), or null if it can't be decoded. */
export async function photoHash(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = 9;
    canvas.height = 8;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 9, 8);
    context.drawImage(bitmap, 0, 0, 9, 8);
    bitmap.close();
    const { data } = context.getImageData(0, 0, 9, 8);
    const gray = Array.from({ length: 72 }, (_, index) => {
      const offset = index * 4;
      return data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
    });
    return differenceHash(gray);
  } catch {
    return null;
  }
}

/** A small WebP (longest side `size`, transparency kept) for closet grids. */
export async function makeThumbnail(source: Blob | string, size = 480): Promise<Blob | null> {
  try {
    const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const thumb = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    // Browsers without WebP encoding fall back to PNG; the server only accepts WebP thumbnails.
    return thumb?.type === "image/webp" ? thumb : null;
  } catch {
    return null;
  }
}

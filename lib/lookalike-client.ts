"use client";

import { findLookalikes, signatureFromPixels, type PieceSignature } from "@/lib/lookalike";
import { type WardrobeItem } from "@/lib/wardrobe-types";

const CACHE_KEY = "rove-piece-signatures";
const memory = new Map<string, PieceSignature | null>();

function cached(url: string) {
  if (memory.has(url)) return memory.get(url);
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, PieceSignature | null>;
    for (const [key, value] of Object.entries(saved)) memory.set(key, value);
  } catch {
    /* storage unavailable: signatures are worked out again next visit */
  }
  return memory.get(url);
}

function remember(url: string, signature: PieceSignature | null) {
  memory.set(url, signature);
  // Blob URLs only live for this page, so only stored images are worth keeping.
  if (url.startsWith("blob:")) return;
  try {
    const saved = Object.fromEntries([...memory].filter(([key]) => !key.startsWith("blob:")).slice(-400));
    localStorage.setItem(CACHE_KEY, JSON.stringify(saved));
  } catch {
    /* not kept: worked out again next visit */
  }
}

/** Signature of a cutout image, from its small grid thumbnail when there is one. */
export async function pieceSignature(url: string): Promise<PieceSignature | null> {
  const known = cached(url);
  if (known !== undefined) return known;
  let signature: PieceSignature | null = null;
  try {
    const bitmap = await createImageBitmap(await (await fetch(url)).blob());
    const scale = Math.min(1, 96 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context) {
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      signature = signatureFromPixels(
        context.getImageData(0, 0, canvas.width, canvas.height).data,
        canvas.width,
        canvas.height,
      );
    }
    bitmap.close();
  } catch {
    signature = null;
  }
  remember(url, signature);
  return signature;
}

/** Signatures for the given pieces, keyed by piece id. */
export async function pieceSignatures(pieces: WardrobeItem[]) {
  const entries: Array<[string, PieceSignature | null]> = [];
  for (const piece of pieces) entries.push([String(piece.id), await pieceSignature(piece.thumb ?? piece.image)]);
  return Object.fromEntries(entries);
}

/** Closet pieces that look like any of the newly detected ones, for a heads-up before adding them. */
export async function closetLookalikes(detected: WardrobeItem[], closet: WardrobeItem[]) {
  const matches = new Map<string, WardrobeItem>();
  for (const piece of detected) {
    const sameCategory = closet.filter((item) => item.category === piece.category && !item.archiveReason);
    if (!sameCategory.length) continue;
    const signature = await pieceSignature(piece.thumb ?? piece.image);
    const signatures = await pieceSignatures(sameCategory);
    for (const match of findLookalikes(piece, signature, sameCategory, signatures))
      matches.set(String(match.id), match);
  }
  return [...matches.values()];
}

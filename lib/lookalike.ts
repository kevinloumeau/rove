// Finds pieces that look like the same garment added twice, kept import-free for node's test runner.
import { differenceHash, hashDistance } from "./photo-hash.ts";

/** A cutout's shape-and-tone hash plus the average color of its opaque pixels. */
export type PieceSignature = { hash: string; rgb: [number, number, number] };

type Piece = { id: number | string; name: string; category: string; color: string };

/** Hashes closer than this, with a close color, read as the same garment. */
export const LOOKALIKE_DISTANCE = 10;
const COLOR_DISTANCE = 45;

/**
 * Signature of a cutout from its RGBA pixels: crops to the opaque area, then hashes a 9x8 gray
 * version drawn on white, so the same garment photographed twice gives close hashes.
 */
export function signatureFromPixels(data: ArrayLike<number>, width: number, height: number): PieceSignature | null {
  let [left, top, right, bottom] = [width, height, -1, -1];
  let [r, g, b, count] = [0, 0, 0, 0];
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 4;
      if (data[at + 3] < 128) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      r += data[at];
      g += data[at + 1];
      b += data[at + 2];
      count += 1;
    }
  if (!count) return null;
  const boxWidth = right - left + 1;
  const boxHeight = bottom - top + 1;
  const gray = Array.from({ length: 72 }, (_, cell) => {
    const column = cell % 9;
    const row = Math.floor(cell / 9);
    // Average the pixels that fall in this cell of the cropped area; transparency counts as white.
    const x0 = left + Math.floor((column * boxWidth) / 9);
    const x1 = left + Math.max(Math.floor(((column + 1) * boxWidth) / 9), Math.floor((column * boxWidth) / 9) + 1);
    const y0 = top + Math.floor((row * boxHeight) / 8);
    const y1 = top + Math.max(Math.floor(((row + 1) * boxHeight) / 8), Math.floor((row * boxHeight) / 8) + 1);
    let sum = 0;
    let cells = 0;
    for (let y = y0; y < y1; y += 1)
      for (let x = x0; x < x1; x += 1) {
        const at = (y * width + x) * 4;
        const alpha = data[at + 3] / 255;
        const value = data[at] * 0.299 + data[at + 1] * 0.587 + data[at + 2] * 0.114;
        sum += value * alpha + 255 * (1 - alpha);
        cells += 1;
      }
    return sum / cells;
  });
  return {
    hash: differenceHash(gray),
    rgb: [r / count, g / count, b / count].map(Math.round) as PieceSignature["rgb"],
  };
}

function colorDistance(a: PieceSignature["rgb"], b: PieceSignature["rgb"]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Whether two pieces are probably the same garment: same category, and the same name or a close cutout. */
export function looksAlike(a: Piece, b: Piece, signatureA?: PieceSignature | null, signatureB?: PieceSignature | null) {
  if (a.category !== b.category) return false;
  const sameName = a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
  if (!signatureA || !signatureB) return sameName;
  const close =
    hashDistance(signatureA.hash, signatureB.hash) <= LOOKALIKE_DISTANCE &&
    colorDistance(signatureA.rgb, signatureB.rgb) <= COLOR_DISTANCE;
  // A shared name only counts when the cutouts don't clearly disagree.
  return close || (sameName && colorDistance(signatureA.rgb, signatureB.rgb) <= COLOR_DISTANCE * 1.5);
}

/** Closet pieces that look like `candidate`. */
export function findLookalikes<T extends Piece>(
  candidate: Piece,
  candidateSignature: PieceSignature | null | undefined,
  pieces: T[],
  signatures: Record<string, PieceSignature | null | undefined>,
) {
  return pieces.filter(
    (piece) =>
      String(piece.id) !== String(candidate.id) &&
      looksAlike(candidate, piece, candidateSignature, signatures[String(piece.id)]),
  );
}

/** Stable key for a pair of pieces, whichever order they come in. */
export function pairKey(a: number | string, b: number | string) {
  return [String(a), String(b)].sort().join("|");
}

/** Pairs of closet pieces that look like doubles, skipping pairs the wearer said to keep. */
export function lookalikePairs<T extends Piece>(
  pieces: T[],
  signatures: Record<string, PieceSignature | null | undefined>,
  kept: Set<string> = new Set(),
) {
  const pairs: Array<[T, T]> = [];
  pieces.forEach((piece, index) => {
    for (const other of pieces.slice(index + 1)) {
      if (kept.has(pairKey(piece.id, other.id))) continue;
      if (looksAlike(piece, other, signatures[String(piece.id)], signatures[String(other.id)]))
        pairs.push([piece, other]);
    }
  });
  return pairs;
}

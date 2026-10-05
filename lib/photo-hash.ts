// Perceptual "difference hash" helpers, kept import-free so node's test runner can load them.

/**
 * Hashes a 9x8 grayscale thumbnail (row-major, 72 values) into 64 bits: each bit says whether a
 * pixel is brighter than its right-hand neighbor. Re-encoded, resized or lightly edited copies of
 * a photo produce the same or a very close hash.
 */
export function differenceHash(gray: ArrayLike<number>) {
  if (gray.length !== 72) throw new Error("differenceHash expects a 9x8 grayscale thumbnail.");
  let hex = "";
  for (let row = 0; row < 8; row += 1) {
    let byte = 0;
    for (let column = 0; column < 8; column += 1) {
      const left = gray[row * 9 + column];
      const right = gray[row * 9 + column + 1];
      byte = (byte << 1) | (left > right ? 1 : 0);
    }
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/** Number of differing bits between two 16-character hex hashes. */
export function hashDistance(a: string, b: string) {
  let distance = 0;
  for (let index = 0; index < 16; index += 2) {
    let bits = parseInt(a.slice(index, index + 2), 16) ^ parseInt(b.slice(index, index + 2), 16);
    while (bits) {
      distance += bits & 1;
      bits >>= 1;
    }
  }
  return distance;
}

/** Hashes this close are treated as the same photo. */
export const DUPLICATE_DISTANCE = 6;

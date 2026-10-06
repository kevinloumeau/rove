/**
 * Splits a "Dress" detection that is really separates. The clothing model often reads a top and
 * trousers of similar color (a brown tank tucked into brown trousers) as one dress, sometimes
 * swallowing the belt too. Everything here works on binary masks at the model's resolution, so it
 * runs (and is tested) without the model.
 */

export type BinaryMask = Uint8Array;

export type SplitInput = {
  width: number;
  height: number;
  dress: BinaryMask;
  upper: BinaryMask;
  bottom: BinaryMask;
  belt: BinaryMask;
  /** RGBA pixels of the photo scaled to the mask size, for finding the waist by color. */
  rgba?: Uint8ClampedArray | Uint8Array;
};

export type SplitPlan = {
  /** First row that belongs to the bottom half; rows above it go to the top. */
  waist: number;
  /**
   * How the waist was found. "labels" means the model also saw a top above and a bottom below,
   * which is proof enough to split; the others only place the waist once a dress is in doubt.
   */
  evidence: "labels" | "belt" | "color" | "proportion";
};

function count(mask: BinaryMask) {
  let total = 0;
  for (const value of mask) if (value) total += 1;
  return total;
}

function rowCounts(mask: BinaryMask, width: number, height: number) {
  const rows = new Float64Array(height);
  for (let y = 0; y < height; y += 1) {
    let total = 0;
    for (let x = 0; x < width; x += 1) if (mask[y * width + x]) total += 1;
    rows[y] = total;
  }
  return rows;
}

function rowSpan(rows: Float64Array) {
  let first = -1;
  let last = -1;
  rows.forEach((value, index) => {
    if (!value) return;
    if (first < 0) first = index;
    last = index;
  });
  return { first, last };
}

/** Row that puts the most top pixels above it and bottom pixels below it. */
function bestSeparatingRow(upperRows: Float64Array, bottomRows: Float64Array) {
  const height = upperRows.length;
  let bottomBelow = bottomRows.reduce((sum, value) => sum + value, 0);
  let upperAbove = 0;
  let best = 0;
  let bestScore = -1;
  for (let row = 0; row <= height; row += 1) {
    const score = upperAbove + bottomBelow;
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
    if (row < height) {
      upperAbove += upperRows[row];
      bottomBelow -= bottomRows[row];
    }
  }
  return best;
}

/**
 * Strongest change in the garment's average color between the rows above and below, searched in
 * the middle of the garment and gently pulled toward its center, so a waist seam or belt wins
 * over a shadow near the hem.
 */
function colorEdgeRow(input: SplitInput, first: number, last: number) {
  const { width, dress, rgba } = input;
  if (!rgba) return null;
  const span = last - first + 1;
  const sums: Array<[number, number, number, number]> = [];
  for (let y = first; y <= last; y += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!dress[index]) continue;
      r += rgba[index * 4];
      g += rgba[index * 4 + 1];
      b += rgba[index * 4 + 2];
      n += 1;
    }
    sums.push([r, g, b, n]);
  }
  const window = Math.max(2, Math.round(span * 0.08));
  const average = (from: number, to: number) => {
    const total = [0, 0, 0, 0];
    for (let i = Math.max(0, from); i < Math.min(sums.length, to); i += 1)
      for (let c = 0; c < 4; c += 1) total[c] += sums[i][c];
    return total[3] ? [total[0] / total[3], total[1] / total[3], total[2] / total[3]] : null;
  };
  let best: number | null = null;
  let bestScore = 0;
  for (let i = Math.round(span * 0.3); i <= Math.round(span * 0.75); i += 1) {
    const above = average(i - window, i);
    const below = average(i, i + window);
    if (!above || !below) continue;
    const difference = Math.hypot(above[0] - below[0], above[1] - below[1], above[2] - below[2]);
    const score = difference * (1 - Math.abs(i / span - 0.5));
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  // Below this the halves are the same color, so the edge is noise.
  return best !== null && bestScore >= 6 ? first + best : null;
}

/** Works out where a dress detection would split into a top and a bottom. Null when there's no dress. */
export function planDressSplit(input: SplitInput): SplitPlan | null {
  const { width, height, dress, upper, bottom, belt } = input;
  const dressArea = count(dress);
  if (!dressArea) return null;
  const dressRows = rowCounts(dress, width, height);
  const { first, last } = rowSpan(dressRows);
  const span = last - first + 1;

  const upperRows = rowCounts(upper, width, height);
  const bottomRows = rowCounts(bottom, width, height);
  const upperArea = upperRows.reduce((sum, value) => sum + value, 0);
  const bottomArea = bottomRows.reduce((sum, value) => sum + value, 0);
  const centroid = (rows: Float64Array, area: number) =>
    rows.reduce((sum, value, index) => sum + value * index, 0) / Math.max(1, area);

  const beltArea = count(belt);
  const beltRows = rowCounts(belt, width, height);
  const beltCenter = centroid(beltRows, beltArea);
  const beltInMiddle =
    beltArea >= Math.max(16, dressArea * 0.005) &&
    beltCenter >= first + span * 0.2 &&
    beltCenter <= first + span * 0.8;

  // The model saw a real top above and a real bottom below the "dress": it's separates.
  if (
    upperArea >= dressArea * 0.05 &&
    bottomArea >= dressArea * 0.05 &&
    centroid(upperRows, upperArea) < centroid(bottomRows, bottomArea)
  ) {
    const waist = beltInMiddle ? Math.round(beltCenter) : bestSeparatingRow(upperRows, bottomRows);
    return { waist, evidence: "labels" };
  }
  if (beltInMiddle) return { waist: Math.round(beltCenter), evidence: "belt" };
  const edge = colorEdgeRow(input, first, last);
  if (edge !== null) return { waist: edge, evidence: "color" };
  // A top usually covers a little under half of a top-and-trousers look from shoulder down.
  return { waist: Math.round(first + span * 0.45), evidence: "proportion" };
}

/**
 * Reassigns dress pixels above the waist to the top and below it to the bottom. The belt keeps
 * its own pixels, and pixels the model already called top or bottom stay where they are.
 */
export function applyDressSplit(input: SplitInput, plan: SplitPlan) {
  const { width, height, dress, upper, bottom } = input;
  const top = new Uint8Array(width * height);
  const lower = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (upper[index]) top[index] = 1;
      else if (bottom[index]) lower[index] = 1;
      else if (dress[index]) (y < plan.waist ? top : lower)[index] = 1;
    }
  }
  return { top, bottom: lower };
}

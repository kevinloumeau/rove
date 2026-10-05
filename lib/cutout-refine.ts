/**
 * Cleans up a garment cutout's edges. The segmentation mask is coarse: its outline is jagged
 * and lets a rim of background through. On product shots with a plain backdrop, edges are cut
 * by color against that backdrop; otherwise the mask outline is smoothed.
 */

type Rgb = [number, number, number];

/** Box blur of a single-channel image, done as two separable running-sum passes. */
export function boxBlur(source: Float32Array, width: number, height: number, radius: number) {
  if (radius < 1) return source.slice();
  const horizontal = new Float32Array(source.length);
  const result = new Float32Array(source.length);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let sum = 0;
    let count = 0;
    for (let x = -radius; x < width + radius; x += 1) {
      const add = x + radius;
      if (add < width) {
        sum += source[row + add];
        count += 1;
      }
      const drop = x - radius - 1;
      if (drop >= 0) {
        sum -= source[row + drop];
        count -= 1;
      }
      if (x >= 0 && x < width) horizontal[row + x] = sum / count;
    }
  }
  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    let count = 0;
    for (let y = -radius; y < height + radius; y += 1) {
      const add = y + radius;
      if (add < height) {
        sum += horizontal[add * width + x];
        count += 1;
      }
      const drop = y - radius - 1;
      if (drop >= 0) {
        sum -= horizontal[drop * width + x];
        count -= 1;
      }
      if (y >= 0 && y < height) result[y * width + x] = sum / count;
    }
  }
  return result;
}

function distance(rgba: Uint8ClampedArray, offset: number, color: Rgb) {
  const dr = rgba[offset] - color[0];
  const dg = rgba[offset + 1] - color[1];
  const db = rgba[offset + 2] - color[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * The backdrop color, when the crop's border (outside the mask) is one plain color, as on
 * product photos. Returns null for busy backgrounds such as a photo of someone wearing it.
 */
export function plainBackdrop(rgba: Uint8ClampedArray, mask: Float32Array, width: number, height: number) {
  const samples: Rgb[] = [];
  const band = Math.max(2, Math.round(Math.min(width, height) * 0.03));
  const step = Math.max(1, Math.round((width + height) / 400));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const nearEdge = x < band || y < band || x >= width - band || y >= height - band;
      if (!nearEdge || mask[y * width + x] > 0) continue;
      const offset = (y * width + x) * 4;
      samples.push([rgba[offset], rgba[offset + 1], rgba[offset + 2]]);
    }
  }
  if (samples.length < 20) return null;
  const median = [0, 1, 2].map((channel) => {
    const values = samples.map((sample) => sample[channel]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  }) as Rgb;
  const close = samples.filter(
    (sample) => Math.hypot(sample[0] - median[0], sample[1] - median[1], sample[2] - median[2]) < 18,
  ).length;
  return close / samples.length >= 0.85 ? median : null;
}

/**
 * Final alpha (0–255) for each pixel of the crop. `mask` is 1 where the segmenter found the
 * garment and 0 elsewhere, at the crop's resolution.
 */
export function refineAlpha(rgba: Uint8ClampedArray, mask: Float32Array, width: number, height: number) {
  const radius = Math.max(2, Math.round(Math.min(width, height) * 0.015));
  const soft = boxBlur(mask, width, height, radius);
  const alpha = new Float32Array(mask.length);
  const backdrop = plainBackdrop(rgba, mask, width, height);

  if (backdrop) {
    // How far the garment's colors sit from the backdrop. A white shirt on white keeps its
    // interior from the mask and only has its edges cut by color.
    let contrast = 0;
    let core = 0;
    for (let index = 0; index < mask.length; index += 1) {
      if (soft[index] < 0.98) continue;
      contrast += distance(rgba, index * 4, backdrop);
      core += 1;
    }
    const keyEverywhere = core > 0 && contrast / core > 45;
    for (let index = 0; index < mask.length; index += 1) {
      if (soft[index] <= 0) continue;
      if (!keyEverywhere && soft[index] >= 0.98) {
        alpha[index] = 1;
        continue;
      }
      alpha[index] = smoothstep(14, 34, distance(rgba, index * 4, backdrop));
    }
  } else {
    for (let index = 0; index < mask.length; index += 1) alpha[index] = smoothstep(0.35, 0.65, soft[index]);
  }

  // A one-pixel blur anti-aliases the new edge.
  const smoothed = boxBlur(alpha, width, height, 1);
  const result = new Uint8ClampedArray(mask.length);
  for (let index = 0; index < mask.length; index += 1) result[index] = Math.round(smoothed[index] * 255);
  return { alpha: result, plainBackdrop: Boolean(backdrop) };
}

/**
 * Clears stray specks: pieces of the cutout that are not connected to the garment. Keeps the
 * largest connected region plus any region at least `minFraction` of its size (a second sleeve
 * or a strap that the mask split off), and zeroes everything else. Works in place and returns
 * how many pixels were cleared.
 */
export function removeSpecks(alpha: Uint8ClampedArray | Uint8Array, width: number, height: number, minFraction = 0.04) {
  const labels = new Int32Array(width * height).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < alpha.length; start += 1) {
    if (alpha[start] < 24 || labels[start] !== -1) continue;
    const label = sizes.length;
    let size = 0;
    labels[start] = label;
    stack.push(start);
    while (stack.length) {
      const index = stack.pop()!;
      size += 1;
      const x = index % width;
      const y = (index - x) / width;
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ];
      for (const next of neighbors) {
        if (next < 0 || labels[next] !== -1 || alpha[next] < 24) continue;
        labels[next] = label;
        stack.push(next);
      }
    }
    sizes.push(size);
  }
  if (sizes.length <= 1) return 0;
  const largest = Math.max(...sizes);
  const keep = sizes.map((size) => size >= largest * minFraction);
  let cleared = 0;
  for (let index = 0; index < alpha.length; index += 1) {
    const label = labels[index];
    if (alpha[index] > 0 && (label === -1 ? false : !keep[label])) {
      alpha[index] = 0;
      cleared += 1;
    }
  }
  return cleared;
}

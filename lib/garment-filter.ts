/**
 * Drops detections too small to be a real garment. The model often labels a few pixels of one
 * garment as another (a sweater hem read as trousers), so clothing must cover at least 2% of the
 * photo and at least 15% of the largest piece found. Shoes and accessories are small by nature,
 * so they only need to clear a 0.3% floor that filters out specks.
 */
export function keepRealGarments<T extends { area: number; small?: boolean }>(found: T[], totalPixels: number) {
  const largest = Math.max(0, ...found.map((item) => item.area));
  const clothingMinimum = Math.max(totalPixels * 0.02, largest * 0.15);
  const smallMinimum = totalPixels * 0.003;
  return found.filter((item) => item.area >= (item.small ? smallMinimum : clothingMinimum));
}

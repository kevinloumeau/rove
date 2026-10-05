export type WardrobeItem = {
  id: number | string;
  importId?: string | null;
  name: string;
  category: string;
  color: string;
  season: string;
  image: string;
  /** Small grid image; falls back to `image` when missing. */
  thumb?: string;
  favorite?: boolean;
  description: string;
  tags?: string[];
  brand?: string;
  size?: string;
  notes?: string;
  /** Purchase price in whole currency units (e.g. dollars), or null when unknown. */
  price?: number | null;
  inLaundry?: boolean;
  wearCount?: number;
  /** ISO date (YYYY-MM-DD) of the most recent wear. */
  lastWorn?: string | null;
  /** ISO date the piece was added to the closet. */
  addedAt?: string | null;
  /** ISO date of the last "Keep" in the declutter review. */
  keptAt?: string | null;
  /** donate, sell or archive for pieces in the let-go pile; empty in the closet. */
  archiveReason?: string;
  archivedAt?: string | null;
};

export type SavedLook = {
  id: string;
  name: string;
  itemIds: Array<number | string>;
  occasion: string;
  favorite?: boolean;
};

export const pieceCategories = ["Tops", "Bottoms", "Outerwear", "Dresses", "Shoes", "Accessories", "Other"];
export const lookOccasions = ["Casual", "Work", "Dinner", "Event"];
export const seasons = ["All season", "Spring / summer", "Fall / winter", "Spring / fall", "Summer", "Winter"];

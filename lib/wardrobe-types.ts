export type WardrobeItem = {
  id: number | string;
  importId?: string | null;
  name: string;
  category: string;
  color: string;
  season: string;
  image: string;
  favorite?: boolean;
  description: string;
  tags?: string[];
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

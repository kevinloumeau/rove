export type WishlistItem = {
  id: string;
  name: string;
  category: string;
  link: string;
  /** Whole currency units, or null when unknown. */
  price: number | null;
  note: string;
  createdAt: number;
  /** Set once marked as bought. */
  boughtAt: number | null;
};

export type WishlistInput = Pick<WishlistItem, "name" | "category" | "link" | "price" | "note">;

/**
 * Checks and tidies a wishlist entry from the client. Returns an error message instead when it can't be saved.
 * Only http(s) links are kept, so a saved link can't run script when opened.
 */
export function cleanWishlistInput(raw: unknown, categories: string[]): WishlistInput | string {
  if (!raw || typeof raw !== "object") return "Describe the piece you want.";
  const value = raw as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim().slice(0, 120) : "";
  if (!name) return "Give the piece a name.";
  const category = typeof value.category === "string" && categories.includes(value.category) ? value.category : "Other";
  let link = typeof value.link === "string" ? value.link.trim().slice(0, 1000) : "";
  if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
  if (link) {
    try {
      const url = new URL(link);
      if (url.protocol !== "https:" && url.protocol !== "http:") return "Use a web link (https://…).";
      link = url.toString();
    } catch {
      return "That link doesn't look right.";
    }
  }
  let price: number | null = null;
  if (value.price !== null && value.price !== undefined && value.price !== "") {
    const parsed = Number(value.price);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000) return "Use a price between 0 and 1,000,000.";
    price = Math.round(parsed);
  }
  const note = typeof value.note === "string" ? value.note.trim().slice(0, 500) : "";
  return { name, category, link, price, note };
}

/** Total of the prices still wanted, ignoring entries without a price. */
export function wishlistTotal(items: WishlistItem[]) {
  return items.filter((item) => !item.boughtAt).reduce((sum, item) => sum + (item.price ?? 0), 0);
}

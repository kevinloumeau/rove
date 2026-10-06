import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const wardrobeImports = sqliteTable(
  "wardrobe_imports",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    originalKey: text("original_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    status: text("status").notNull().default("processing"),
    detectedCount: integer("detected_count").notNull().default(0),
    /** 64-bit difference hash of the photo, as 16 hex characters, used to warn about re-imports. */
    photoHash: text("photo_hash"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("wardrobe_imports_user_created_idx").on(table.userId, table.createdAt)],
);

export const wardrobeItems = sqliteTable(
  "wardrobe_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    importId: text("import_id").references(() => wardrobeImports.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    color: text("color").notNull(),
    season: text("season").notNull(),
    description: text("description").notNull(),
    imageKey: text("image_key").notNull(),
    /** Small WebP for grids; empty for pieces added before thumbnails existed. */
    thumbKey: text("thumb_key").notNull().default(""),
    tags: text("tags").notNull().default("[]"),
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    brand: text("brand").notNull().default(""),
    size: text("size").notNull().default(""),
    notes: text("notes").notNull().default(""),
    /** Purchase price in cents, or null when unknown. */
    priceCents: integer("price_cents"),
    inLaundry: integer("in_laundry", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("draft"),
    /** Why an archived piece left the closet: donate, sell or archive. Empty while the piece is in the closet. */
    archiveReason: text("archive_reason").notNull().default(""),
    archivedAt: integer("archived_at"),
    /** When the wearer last chose "Keep" in the declutter review, so it isn't suggested again right away. */
    keptAt: integer("kept_at"),
    /** When the piece was packed away for the off season. Stored pieces stay out of the closet grid and outfit ideas. */
    storedAt: integer("stored_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("wardrobe_items_user_status_created_idx").on(table.userId, table.status, table.createdAt),
    index("wardrobe_items_import_idx").on(table.importId),
  ],
);

export const wardrobeOutfits = sqliteTable(
  "wardrobe_outfits",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    occasion: text("occasion").notNull().default("Casual"),
    itemIds: text("item_ids").notNull().default("[]"),
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("wardrobe_outfits_user_created_idx").on(table.userId, table.createdAt)],
);

export const wardrobePlans = sqliteTable(
  "wardrobe_plans",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    outfitId: text("outfit_id").notNull(),
    plannedDate: text("planned_date").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("wardrobe_plans_user_date_idx").on(table.userId, table.plannedDate)],
);

/** One row per piece per day it was worn. */
export const wardrobeWears = sqliteTable(
  "wardrobe_wears",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    itemId: text("item_id").notNull(),
    wornOn: text("worn_on").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("wardrobe_wears_user_item_day_idx").on(table.userId, table.itemId, table.wornOn)],
);

/** One row per day the wearer added a photo or note to their outfit journal. What they wore comes from wardrobe_wears. */
export const wardrobeJournal = sqliteTable(
  "wardrobe_journal",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    day: text("day").notNull(),
    note: text("note").notNull().default(""),
    photoKey: text("photo_key").notNull().default(""),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("wardrobe_journal_user_day_idx").on(table.userId, table.day)],
);

export const wardrobeWishlist = sqliteTable(
  "wardrobe_wishlist",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default("Other"),
    link: text("link").notNull().default(""),
    /** Price in whole currency units, like wardrobe_items.price. */
    price: integer("price"),
    note: text("note").notNull().default(""),
    createdAt: integer("created_at").notNull(),
    /** When it was marked as bought; null while still wanted. */
    boughtAt: integer("bought_at"),
  },
  (table) => [index("wardrobe_wishlist_user_idx").on(table.userId, table.createdAt)],
);

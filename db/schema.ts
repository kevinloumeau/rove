import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    tags: text("tags").notNull().default("[]"),
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("draft"),
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

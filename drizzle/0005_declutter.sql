ALTER TABLE `wardrobe_items` ADD `archive_reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `wardrobe_items` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `wardrobe_items` ADD `kept_at` integer;
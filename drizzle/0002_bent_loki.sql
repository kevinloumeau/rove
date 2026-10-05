CREATE TABLE `wardrobe_wears` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`item_id` text NOT NULL,
	`worn_on` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wardrobe_wears_user_item_day_idx` ON `wardrobe_wears` (`user_id`,`item_id`,`worn_on`);--> statement-breakpoint
ALTER TABLE `wardrobe_items` ADD `brand` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `wardrobe_items` ADD `size` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `wardrobe_items` ADD `notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `wardrobe_items` ADD `price_cents` integer;--> statement-breakpoint
ALTER TABLE `wardrobe_items` ADD `in_laundry` integer DEFAULT false NOT NULL;
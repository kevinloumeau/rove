CREATE TABLE `wardrobe_outfits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`occasion` text DEFAULT 'Casual' NOT NULL,
	`item_ids` text DEFAULT '[]' NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wardrobe_outfits_user_created_idx` ON `wardrobe_outfits` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `wardrobe_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`outfit_id` text NOT NULL,
	`planned_date` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wardrobe_plans_user_date_idx` ON `wardrobe_plans` (`user_id`,`planned_date`);
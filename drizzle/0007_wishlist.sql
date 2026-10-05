CREATE TABLE `wardrobe_wishlist` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'Other' NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`price` integer,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`bought_at` integer
);
--> statement-breakpoint
CREATE INDEX `wardrobe_wishlist_user_idx` ON `wardrobe_wishlist` (`user_id`,`created_at`);
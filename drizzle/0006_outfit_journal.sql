CREATE TABLE `wardrobe_journal` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`photo_key` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wardrobe_journal_user_day_idx` ON `wardrobe_journal` (`user_id`,`day`);
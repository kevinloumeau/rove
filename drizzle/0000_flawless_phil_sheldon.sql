CREATE TABLE `wardrobe_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`original_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`detected_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wardrobe_imports_user_created_idx` ON `wardrobe_imports` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `wardrobe_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`import_id` text,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`color` text NOT NULL,
	`season` text NOT NULL,
	`description` text NOT NULL,
	`image_key` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `wardrobe_imports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `wardrobe_items_user_status_created_idx` ON `wardrobe_items` (`user_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `wardrobe_items_import_idx` ON `wardrobe_items` (`import_id`);
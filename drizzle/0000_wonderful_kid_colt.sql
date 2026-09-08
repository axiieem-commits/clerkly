CREATE TABLE `cases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`posting` text NOT NULL,
	`presentation` text NOT NULL,
	`learning` text NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'To review' NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);

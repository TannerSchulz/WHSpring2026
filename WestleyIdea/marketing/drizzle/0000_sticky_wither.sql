CREATE TABLE `demo_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`company` text NOT NULL,
	`role` text NOT NULL,
	`team_size` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'marketing-site' NOT NULL
);

CREATE TABLE `api_key_projects` (
	`key_id` text NOT NULL,
	`project_slug` text NOT NULL,
	PRIMARY KEY(`key_id`, `project_slug`),
	FOREIGN KEY (`key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_slug`) REFERENCES `projects`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`key_hash` text NOT NULL,
	`label` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` text NOT NULL,
	`key_id` text,
	`project_slug` text,
	`method` text NOT NULL,
	`endpoint` text NOT NULL,
	`app_id` text,
	`result` text NOT NULL,
	`reason` text,
	`response_status` integer
);
--> statement-breakpoint
CREATE TABLE `blocklist` (
	`app_id` text NOT NULL,
	`project_slug` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`app_id`, `project_slug`),
	FOREIGN KEY (`project_slug`) REFERENCES `projects`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `key_scopes` (
	`key_id` text NOT NULL,
	`project_slug` text NOT NULL,
	`scope` text NOT NULL,
	`target` text DEFAULT '*' NOT NULL,
	PRIMARY KEY(`key_id`, `project_slug`, `scope`, `target`),
	FOREIGN KEY (`key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_slug`) REFERENCES `projects`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`slug` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`nodion_api_key_encrypted` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `resources` (
	`app_id` text NOT NULL,
	`project_slug` text NOT NULL,
	`created_by_key` text NOT NULL,
	`created_at` text NOT NULL,
	`label` text,
	`last_deployed_at` text,
	PRIMARY KEY(`app_id`, `project_slug`),
	FOREIGN KEY (`project_slug`) REFERENCES `projects`(`slug`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_key`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE no action
);

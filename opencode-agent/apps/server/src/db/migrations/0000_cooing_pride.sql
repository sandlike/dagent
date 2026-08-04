CREATE TABLE `instances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`owner_id` int NOT NULL,
	`namespace` varchar(64) NOT NULL,
	`status` enum('running','deploying','error','stopped') NOT NULL DEFAULT 'deploying',
	`config_json` text NOT NULL,
	`model_id` varchar(128),
	`provider` varchar(64),
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	`updated_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `instances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE INDEX `idx_owner` ON `instances` (`owner_id`);
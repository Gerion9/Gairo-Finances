CREATE TABLE `accounts` (
	`account_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email_at_binding` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "account_slot" CHECK("accounts"."account_id" IN ('gairo', 'ricardo'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_user_id_unique` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `ai_limits` (
	`account_id` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`request_count` integer NOT NULL,
	`lease_id` text,
	`lease_until` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`account_id` text PRIMARY KEY NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`revision` integer NOT NULL,
	`data_json` text NOT NULL,
	`receipts_json` text DEFAULT '[]' NOT NULL,
	`migration_hash` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "positive_revision" CHECK("workspaces"."revision" > 0)
);

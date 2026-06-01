CREATE TABLE `password_lockers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`label` text NOT NULL,
	`service` text DEFAULT 'other' NOT NULL,
	`username` text,
	`account_email` text,
	`login_url` text,
	`password_encrypted` text NOT NULL,
	`password_iv` text NOT NULL,
	`notes` text,
	`contact_id` text,
	`company_id` text,
	`created_by` text NOT NULL,
	`updated_by` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `password_lockers_org_idx` ON `password_lockers` (`organization_id`);--> statement-breakpoint
CREATE INDEX `password_lockers_service_idx` ON `password_lockers` (`service`);--> statement-breakpoint
CREATE INDEX `password_lockers_contact_idx` ON `password_lockers` (`contact_id`);--> statement-breakpoint
CREATE INDEX `password_lockers_company_idx` ON `password_lockers` (`company_id`);
CREATE TABLE `client_services` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`company_id` text NOT NULL,
	`service_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`override_cost_cents` integer,
	`billed_amount_cents` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`start_date` text,
	`end_date` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `service_expense_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`service_id` text NOT NULL,
	`period` text NOT NULL,
	`actual_cost_cents` integer DEFAULT 0 NOT NULL,
	`invoice_ref` text,
	`notes` text,
	`allocations` text DEFAULT '[]' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`billing_type` text DEFAULT 'fixed' NOT NULL,
	`unit_cost_cents` integer DEFAULT 0 NOT NULL,
	`default_markup_pct` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`billing_cycle` text DEFAULT 'monthly' NOT NULL,
	`logo_url` text,
	`url` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `client_services_org_idx` ON `client_services` (`organization_id`);--> statement-breakpoint
CREATE INDEX `client_services_company_idx` ON `client_services` (`company_id`);--> statement-breakpoint
CREATE INDEX `client_services_service_idx` ON `client_services` (`service_id`);--> statement-breakpoint
CREATE INDEX `svc_expense_logs_org_idx` ON `service_expense_logs` (`organization_id`);--> statement-breakpoint
CREATE INDEX `svc_expense_logs_service_idx` ON `service_expense_logs` (`service_id`);--> statement-breakpoint
CREATE INDEX `svc_expense_logs_period_idx` ON `service_expense_logs` (`period`);--> statement-breakpoint
CREATE INDEX `services_org_idx` ON `services` (`organization_id`);--> statement-breakpoint
CREATE INDEX `services_category_idx` ON `services` (`category`);
CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`type` text NOT NULL,
	`subject` text NOT NULL,
	`description` text,
	`contact_id` text,
	`company_id` text,
	`opportunity_id` text,
	`owner_id` text NOT NULL,
	`scheduled_at` text,
	`completed_at` text,
	`duration` integer,
	`outcome` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `analytics_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`zone_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `analytics_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text NOT NULL,
	`zone_id` text NOT NULL,
	`metrics` text DEFAULT '{}' NOT NULL,
	`traffic_timeseries` text DEFAULT '[]' NOT NULL,
	`top_pages` text DEFAULT '[]' NOT NULL,
	`top_countries` text DEFAULT '[]' NOT NULL,
	`security_events` text DEFAULT '[]' NOT NULL,
	`date_filter` text DEFAULT '{}' NOT NULL,
	`captured_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `analytics_domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`scopes` text DEFAULT '[]' NOT NULL,
	`created_by` text NOT NULL,
	`last_used_at` text,
	`expires_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`entity_label` text NOT NULL,
	`changes` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`domain` text,
	`industry` text,
	`size` text,
	`revenue` real,
	`phone` text,
	`email` text,
	`website` text,
	`owner_id` text,
	`status` text DEFAULT 'prospect' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`address` text,
	`notes` text,
	`custom_fields` text DEFAULT '{}' NOT NULL,
	`logo_url` text,
	`last_activity_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text,
	`phone` text,
	`mobile` text,
	`title` text,
	`department` text,
	`company_id` text,
	`owner_id` text,
	`status` text DEFAULT 'lead' NOT NULL,
	`source` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`address` text,
	`notes` text,
	`custom_fields` text DEFAULT '{}' NOT NULL,
	`avatar_url` text,
	`last_activity_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `custom_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`entity` text NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`type` text NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`options` text,
	`relation_entity` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `document_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`version` integer NOT NULL,
	`r2_key` text NOT NULL,
	`size` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`change_note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`original_name` text NOT NULL,
	`folder_id` text,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`extension` text NOT NULL,
	`r2_key` text NOT NULL,
	`thumbnail_url` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`description` text,
	`is_locked` integer DEFAULT false NOT NULL,
	`locked_by` text,
	`locked_at` text,
	`contact_id` text,
	`company_id` text,
	`opportunity_id` text,
	`owner_id` text NOT NULL,
	`current_version` integer DEFAULT 1 NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`locked_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`path` text NOT NULL,
	`owner_id` text NOT NULL,
	`is_shared` integer DEFAULT false NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`content` text NOT NULL,
	`contact_id` text,
	`company_id` text,
	`opportunity_id` text,
	`is_pinned` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`data` text,
	`action_url` text,
	`read_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`contact_id` text,
	`company_id` text,
	`owner_id` text,
	`stage` text DEFAULT 'prospecting' NOT NULL,
	`value` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`probability` integer DEFAULT 20 NOT NULL,
	`expected_close_date` text,
	`source` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`custom_fields` text DEFAULT '{}' NOT NULL,
	`last_activity_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo_url` text,
	`plan` text DEFAULT 'starter' NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`stripe_customer_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saved_views` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`entity` text NOT NULL,
	`view_type` text DEFAULT 'table' NOT NULL,
	`filters` text,
	`sort` text,
	`columns` text DEFAULT '[]' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`is_shared` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stripe_customers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`stripe_customer_id` text NOT NULL,
	`contact_id` text,
	`company_id` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`currency` text DEFAULT 'usd' NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`delinquent` integer DEFAULT false NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `stripe_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`stripe_invoice_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`number` text,
	`currency` text DEFAULT 'usd' NOT NULL,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`tax` integer DEFAULT 0 NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`amount_paid` integer DEFAULT 0 NOT NULL,
	`amount_due` integer DEFAULT 0 NOT NULL,
	`line_items` text DEFAULT '[]' NOT NULL,
	`due_date` text,
	`paid_at` text,
	`period_start` text,
	`period_end` text,
	`pdf_url` text,
	`hosted_url` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `stripe_customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stripe_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`stripe_subscription_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`plan_name` text NOT NULL,
	`plan_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`currency` text DEFAULT 'usd' NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`interval` text NOT NULL,
	`interval_count` integer DEFAULT 1 NOT NULL,
	`current_period_start` text NOT NULL,
	`current_period_end` text NOT NULL,
	`cancel_at` text,
	`canceled_at` text,
	`trial_start` text,
	`trial_end` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `stripe_customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`assignee_id` text,
	`contact_id` text,
	`company_id` text,
	`opportunity_id` text,
	`due_date` text,
	`completed_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`firebase_uid` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`role` text DEFAULT 'read_only' NOT NULL,
	`organization_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`permissions` text DEFAULT '{}' NOT NULL,
	`preferences` text DEFAULT '{}' NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activities_org_idx` ON `activities` (`organization_id`);--> statement-breakpoint
CREATE INDEX `activities_type_idx` ON `activities` (`type`);--> statement-breakpoint
CREATE INDEX `activities_contact_idx` ON `activities` (`contact_id`);--> statement-breakpoint
CREATE INDEX `activities_owner_idx` ON `activities` (`owner_id`);--> statement-breakpoint
CREATE INDEX `analytics_domains_org_idx` ON `analytics_domains` (`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `analytics_domains_zone_id_idx` ON `analytics_domains` (`organization_id`,`zone_id`);--> statement-breakpoint
CREATE INDEX `analytics_snapshots_domain_idx` ON `analytics_snapshots` (`domain_id`);--> statement-breakpoint
CREATE INDEX `analytics_snapshots_captured_at_idx` ON `analytics_snapshots` (`captured_at`);--> statement-breakpoint
CREATE INDEX `api_keys_org_idx` ON `api_keys` (`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_idx` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `audit_logs_org_idx` ON `audit_logs` (`organization_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_user_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `companies_org_idx` ON `companies` (`organization_id`);--> statement-breakpoint
CREATE INDEX `companies_name_idx` ON `companies` (`name`);--> statement-breakpoint
CREATE INDEX `companies_domain_idx` ON `companies` (`domain`);--> statement-breakpoint
CREATE INDEX `companies_owner_idx` ON `companies` (`owner_id`);--> statement-breakpoint
CREATE INDEX `contacts_org_idx` ON `contacts` (`organization_id`);--> statement-breakpoint
CREATE INDEX `contacts_email_idx` ON `contacts` (`email`);--> statement-breakpoint
CREATE INDEX `contacts_company_idx` ON `contacts` (`company_id`);--> statement-breakpoint
CREATE INDEX `contacts_owner_idx` ON `contacts` (`owner_id`);--> statement-breakpoint
CREATE INDEX `contacts_status_idx` ON `contacts` (`status`);--> statement-breakpoint
CREATE INDEX `custom_fields_org_entity_idx` ON `custom_fields` (`organization_id`,`entity`);--> statement-breakpoint
CREATE UNIQUE INDEX `custom_fields_unique_key_idx` ON `custom_fields` (`organization_id`,`entity`,`key`);--> statement-breakpoint
CREATE INDEX `doc_versions_doc_idx` ON `document_versions` (`document_id`);--> statement-breakpoint
CREATE INDEX `documents_org_idx` ON `documents` (`organization_id`);--> statement-breakpoint
CREATE INDEX `documents_folder_idx` ON `documents` (`folder_id`);--> statement-breakpoint
CREATE INDEX `documents_owner_idx` ON `documents` (`owner_id`);--> statement-breakpoint
CREATE INDEX `documents_mime_type_idx` ON `documents` (`mime_type`);--> statement-breakpoint
CREATE INDEX `folders_org_idx` ON `folders` (`organization_id`);--> statement-breakpoint
CREATE INDEX `folders_parent_idx` ON `folders` (`parent_id`);--> statement-breakpoint
CREATE INDEX `notes_org_idx` ON `notes` (`organization_id`);--> statement-breakpoint
CREATE INDEX `notes_contact_idx` ON `notes` (`contact_id`);--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `notifications_is_read_idx` ON `notifications` (`is_read`);--> statement-breakpoint
CREATE INDEX `notifications_org_idx` ON `notifications` (`organization_id`);--> statement-breakpoint
CREATE INDEX `opportunities_org_idx` ON `opportunities` (`organization_id`);--> statement-breakpoint
CREATE INDEX `opportunities_stage_idx` ON `opportunities` (`stage`);--> statement-breakpoint
CREATE INDEX `opportunities_owner_idx` ON `opportunities` (`owner_id`);--> statement-breakpoint
CREATE INDEX `opportunities_contact_idx` ON `opportunities` (`contact_id`);--> statement-breakpoint
CREATE INDEX `opportunities_company_idx` ON `opportunities` (`company_id`);--> statement-breakpoint
CREATE INDEX `saved_views_org_entity_idx` ON `saved_views` (`organization_id`,`entity`);--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_customers_stripe_id_idx` ON `stripe_customers` (`stripe_customer_id`);--> statement-breakpoint
CREATE INDEX `stripe_customers_org_idx` ON `stripe_customers` (`organization_id`);--> statement-breakpoint
CREATE INDEX `stripe_customers_email_idx` ON `stripe_customers` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_invoices_stripe_id_idx` ON `stripe_invoices` (`stripe_invoice_id`);--> statement-breakpoint
CREATE INDEX `stripe_invoices_org_idx` ON `stripe_invoices` (`organization_id`);--> statement-breakpoint
CREATE INDEX `stripe_invoices_customer_idx` ON `stripe_invoices` (`customer_id`);--> statement-breakpoint
CREATE INDEX `stripe_invoices_status_idx` ON `stripe_invoices` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_subs_stripe_id_idx` ON `stripe_subscriptions` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `stripe_subs_org_idx` ON `stripe_subscriptions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `stripe_subs_customer_idx` ON `stripe_subscriptions` (`customer_id`);--> statement-breakpoint
CREATE INDEX `stripe_subs_status_idx` ON `stripe_subscriptions` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_org_idx` ON `tasks` (`organization_id`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_assignee_idx` ON `tasks` (`assignee_id`);--> statement-breakpoint
CREATE INDEX `tasks_due_date_idx` ON `tasks` (`due_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_firebase_uid_idx` ON `users` (`firebase_uid`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_org_idx` ON `users` (`organization_id`);
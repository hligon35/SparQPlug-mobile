ALTER TABLE `companies` ADD COLUMN `logo_url` text;
--> statement-breakpoint
ALTER TABLE `stripe_invoices` ADD COLUMN `label` text;
--> statement-breakpoint
ALTER TABLE `stripe_subscriptions` ADD COLUMN `label` text;
ALTER TABLE `stripe_invoices` ADD COLUMN `label` text;
--> statement-breakpoint
ALTER TABLE `stripe_subscriptions` ADD COLUMN `label` text;
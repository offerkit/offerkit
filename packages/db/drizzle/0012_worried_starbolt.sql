CREATE TABLE "workspace_setting" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT 'open-voucherify' NOT NULL,
	"default_currency" text DEFAULT 'USD' NOT NULL,
	"default_timezone" text DEFAULT 'UTC' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

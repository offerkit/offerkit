CREATE TABLE "campaign" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"currency" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"code_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"validation_rule_id" uuid,
	"auto_apply" boolean DEFAULT false NOT NULL,
	"voucher_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redemption" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_id" uuid NOT NULL,
	"customer_id" uuid,
	"order_id" text,
	"result" text NOT NULL,
	"failure_reason" text,
	"amount" integer,
	"breakdown" jsonb,
	"idempotency_key" text,
	"parent_redemption_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active_revision_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reward_type_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "reward_type_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reward_type_id" uuid NOT NULL,
	"payload_schema" jsonb NOT NULL,
	"checksum" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rule" jsonb NOT NULL,
	"applies_to" text DEFAULT 'voucher' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voucher" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"campaign_id" uuid,
	"type" text NOT NULL,
	"discount" jsonb,
	"custom_rewards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gift_balance" integer,
	"loyalty_points" integer,
	"redemption_limit" integer,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"exclusive" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"customer_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voucher_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_validation_rule_id_validation_rule_id_fk" FOREIGN KEY ("validation_rule_id") REFERENCES "public"."validation_rule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption" ADD CONSTRAINT "redemption_voucher_id_voucher_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."voucher"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption" ADD CONSTRAINT "redemption_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_type_revision" ADD CONSTRAINT "reward_type_revision_reward_type_id_reward_type_id_fk" FOREIGN KEY ("reward_type_id") REFERENCES "public"."reward_type"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher" ADD CONSTRAINT "voucher_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher" ADD CONSTRAINT "voucher_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_type_idx" ON "campaign" USING btree ("type");--> statement-breakpoint
CREATE INDEX "campaign_status_idx" ON "campaign" USING btree ("status");--> statement-breakpoint
CREATE INDEX "campaign_deleted_at_idx" ON "campaign" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "redemption_voucher_id_idx" ON "redemption" USING btree ("voucher_id");--> statement-breakpoint
CREATE INDEX "redemption_customer_id_idx" ON "redemption" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "redemption_created_at_idx" ON "redemption" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "redemption_voucher_idempotency_idx" ON "redemption" USING btree ("voucher_id","idempotency_key") WHERE "redemption"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "reward_type_deleted_at_idx" ON "reward_type" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "reward_type_revision_reward_type_id_idx" ON "reward_type_revision" USING btree ("reward_type_id");--> statement-breakpoint
CREATE INDEX "validation_rule_deleted_at_idx" ON "validation_rule" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "voucher_campaign_id_idx" ON "voucher" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "voucher_customer_id_idx" ON "voucher" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "voucher_active_idx" ON "voucher" USING btree ("active");--> statement-breakpoint
CREATE INDEX "voucher_deleted_at_idx" ON "voucher" USING btree ("deleted_at");
CREATE TABLE "referral" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"referrer_customer_id" uuid NOT NULL,
	"referee_customer_id" uuid,
	"code" text NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"converted_at" timestamp with time zone,
	"conversion_event_id" text,
	"referrer_redemption_id" uuid,
	"referee_redemption_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_code_unique" UNIQUE("code"),
	CONSTRAINT "referral_program_referrer_unique" UNIQUE("program_id","referrer_customer_id")
);
--> statement-breakpoint
CREATE TABLE "referral_program" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"referrer_reward" jsonb NOT NULL,
	"referee_reward" jsonb NOT NULL,
	"code_length" integer DEFAULT 8 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_program_campaign_id_unique" UNIQUE("campaign_id")
);
--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_program_id_referral_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."referral_program"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referrer_customer_id_customer_id_fk" FOREIGN KEY ("referrer_customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referee_customer_id_customer_id_fk" FOREIGN KEY ("referee_customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referrer_redemption_id_redemption_id_fk" FOREIGN KEY ("referrer_redemption_id") REFERENCES "public"."redemption"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referee_redemption_id_redemption_id_fk" FOREIGN KEY ("referee_redemption_id") REFERENCES "public"."redemption"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_program" ADD CONSTRAINT "referral_program_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referral_program_id_idx" ON "referral" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "referral_referrer_customer_id_idx" ON "referral" USING btree ("referrer_customer_id");--> statement-breakpoint
CREATE INDEX "referral_status_idx" ON "referral" USING btree ("status");--> statement-breakpoint
CREATE INDEX "referral_program_deleted_at_idx" ON "referral_program" USING btree ("deleted_at");
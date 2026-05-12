-- Refactor referrals to support refer-a-friend semantics.
--
-- Before: `referral` conflated "the code" with "the conversion" — a unique
-- (programId, referrerCustomerId) row that also held the single conversion's
-- referee + status. That works for one-shot referrals but NOT for refer-a-
-- friend where one stable code earns the referrer rewards across many
-- friends.
--
-- After:
--   referral_code        — stable (programId, referrerCustomerId) → code
--   referral_conversion  — many per code, one per (codeId, refereeCustomerId)
--
-- Data preservation:
-- - Every old `referral` row becomes one `referral_code` row (same id, same
--   code, same created_at). This keeps any external references to the old
--   id continuing to resolve to the code.
-- - Rows that were `status = 'converted'` AND had a `referee_customer_id`
--   set become one `referral_conversion` row. The old schema never recorded
--   the issued voucher codes (the `*_redemption_id` columns were dead), so
--   the legacy outcome is captured as a kind-only placeholder derived from
--   the parent program's reward template. New conversions store the full
--   outcome with voucher codes / loyalty tx ids.

CREATE TABLE "referral_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"referrer_customer_id" uuid NOT NULL,
	"code" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_code_code_unique" UNIQUE("code"),
	CONSTRAINT "referral_code_program_referrer_unique" UNIQUE("program_id","referrer_customer_id")
);
--> statement-breakpoint
CREATE TABLE "referral_conversion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_id" uuid NOT NULL,
	"referee_customer_id" uuid NOT NULL,
	"status" text DEFAULT 'converted' NOT NULL,
	"converted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"conversion_event_id" text,
	"referrer_outcome" jsonb NOT NULL,
	"referee_outcome" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_conversion_code_referee_unique" UNIQUE("code_id","referee_customer_id")
);
--> statement-breakpoint
ALTER TABLE "referral_code" ADD CONSTRAINT "referral_code_program_id_referral_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."referral_program"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_code" ADD CONSTRAINT "referral_code_referrer_customer_id_customer_id_fk" FOREIGN KEY ("referrer_customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_conversion" ADD CONSTRAINT "referral_conversion_code_id_referral_code_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."referral_code"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_conversion" ADD CONSTRAINT "referral_conversion_referee_customer_id_customer_id_fk" FOREIGN KEY ("referee_customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referral_code_program_id_idx" ON "referral_code" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "referral_code_referrer_customer_id_idx" ON "referral_code" USING btree ("referrer_customer_id");--> statement-breakpoint
CREATE INDEX "referral_conversion_code_id_idx" ON "referral_conversion" USING btree ("code_id");--> statement-breakpoint
CREATE INDEX "referral_conversion_referee_customer_id_idx" ON "referral_conversion" USING btree ("referee_customer_id");--> statement-breakpoint
CREATE INDEX "referral_conversion_status_idx" ON "referral_conversion" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_conversion_code_event_unique" ON "referral_conversion" USING btree ("code_id","conversion_event_id") WHERE "conversion_event_id" IS NOT NULL;--> statement-breakpoint
-- Migrate data from legacy `referral` table if it exists. Skip silently for
-- fresh installs. Legacy outcomes are placeholder kind-only objects since the
-- old schema never recorded the issued voucher codes.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name = 'referral'
	) THEN
		INSERT INTO "referral_code" (id, program_id, referrer_customer_id, code, created_at, updated_at)
		SELECT id, program_id, referrer_customer_id, code, created_at, updated_at FROM "referral";

		INSERT INTO "referral_conversion" (
			code_id, referee_customer_id, status, converted_at, conversion_event_id,
			referrer_outcome, referee_outcome, created_at, updated_at
		)
		SELECT
			r.id, r.referee_customer_id, 'converted',
			COALESCE(r.converted_at, r.updated_at),
			r.conversion_event_id,
			jsonb_build_object('kind', rp.referrer_reward->>'kind'),
			jsonb_build_object('kind', rp.referee_reward->>'kind'),
			COALESCE(r.converted_at, r.created_at),
			r.updated_at
		FROM "referral" r
		JOIN "referral_program" rp ON rp.id = r.program_id
		WHERE r.status = 'converted' AND r.referee_customer_id IS NOT NULL;

		DROP TABLE "referral";
	END IF;
END $$;

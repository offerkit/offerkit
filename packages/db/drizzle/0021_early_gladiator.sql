ALTER TABLE "webhook" ALTER COLUMN "hashed_secret" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook" ADD COLUMN "encrypted_secret" text;
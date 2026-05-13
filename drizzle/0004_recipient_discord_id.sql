ALTER TABLE "transfers" ADD COLUMN "recipient_discord_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfers_recipient_discord_id_idx" ON "transfers" ("recipient_discord_id");--> statement-breakpoint
UPDATE "transfers" SET "recipient_discord_id" = u."discord_id" FROM "users" u WHERE u."username" = "transfers"."recipient_username" AND "transfers"."recipient_discord_id" IS NULL;

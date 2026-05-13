ALTER TABLE "transfers" DROP CONSTRAINT IF EXISTS "transfers_recipient_id_users_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "transfers_recipient_idx";--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "recipient_username" text;--> statement-breakpoint
UPDATE "transfers" SET "recipient_username" = "users"."username" FROM "users" WHERE "transfers"."recipient_id" = "users"."id";--> statement-breakpoint
-- Safety net for transfers whose recipient row was already gone (on-delete-set-null).
-- A random-suffixed sentinel keeps them unaddressable so a future signup of the
-- same handle cannot inherit a stranger's transfer.
UPDATE "transfers" SET "recipient_username" = 'deleted-' || gen_random_uuid() WHERE "recipient_username" IS NULL;--> statement-breakpoint
ALTER TABLE "transfers" ALTER COLUMN "recipient_username" SET NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfers_recipient_username_idx" ON "transfers" USING btree ("recipient_username");--> statement-breakpoint
ALTER TABLE "transfers" DROP COLUMN IF EXISTS "recipient_id";

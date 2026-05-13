ALTER TABLE "transfers" ALTER COLUMN "expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "pending_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfers_pending_expires_at_idx" ON "transfers" USING btree ("pending_expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfers_status_idx" ON "transfers" USING btree ("status");

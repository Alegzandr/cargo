CREATE TABLE IF NOT EXISTS "download_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"ip_hash" "bytea" NOT NULL,
	"ua_hash" "bytea" NOT NULL,
	"bytes_sent" bigint DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid,
	"recipient_id" uuid,
	"filename" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"blob_path" text NOT NULL,
	"dek_wrapped" "bytea" NOT NULL,
	"dek_wrap_iv" "bytea" NOT NULL,
	"dek_wrap_tag" "bytea" NOT NULL,
	"content_iv" "bytea" NOT NULL,
	"content_tag" "bytea",
	"status" text DEFAULT 'uploading' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_id" text NOT NULL,
	"username" text NOT NULL,
	"global_name" text,
	"avatar_url" text,
	"locale" text DEFAULT 'en' NOT NULL,
	"storage_used_bytes" bigint DEFAULT 0 NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "download_sessions" ADD CONSTRAINT "download_sessions_transfer_id_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transfers" ADD CONSTRAINT "transfers_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transfers" ADD CONSTRAINT "transfers_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "download_sessions_transfer_idx" ON "download_sessions" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfers_sender_idx" ON "transfers" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfers_recipient_idx" ON "transfers" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfers_expires_at_idx" ON "transfers" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_username_lower_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_global_name_lower_idx" ON "users" USING btree ("global_name");
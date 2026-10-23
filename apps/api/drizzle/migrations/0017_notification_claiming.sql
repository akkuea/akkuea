ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "claimed_at" timestamp with time zone;

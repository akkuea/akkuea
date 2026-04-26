CREATE SEQUENCE IF NOT EXISTS properties_soroban_property_id_seq START WITH 1 INCREMENT BY 1;
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "soroban_property_id" bigint;
--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_soroban_property_id_unique" UNIQUE("soroban_property_id");

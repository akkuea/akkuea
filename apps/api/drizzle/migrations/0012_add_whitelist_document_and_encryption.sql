ALTER TABLE "pilot_whitelist_requests" ADD COLUMN "full_name_encrypted" text;
ALTER TABLE "pilot_whitelist_requests" ADD COLUMN "id_reference_encrypted" text;
ALTER TABLE "pilot_whitelist_requests" ADD COLUMN "document_url" text;
ALTER TABLE "pilot_whitelist_requests" ADD COLUMN "document_encryption_key" text;
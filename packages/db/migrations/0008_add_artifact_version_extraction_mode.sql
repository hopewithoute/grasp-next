ALTER TABLE "artifact_versions"
ADD COLUMN "extraction_mode" text DEFAULT 'deterministic' NOT NULL;

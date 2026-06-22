ALTER TABLE "project_sources" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "source_passages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "project_sources" CASCADE;--> statement-breakpoint
DROP TABLE "source_passages" CASCADE;--> statement-breakpoint
ALTER TABLE "ingestion_runs" DROP CONSTRAINT "ingestion_runs_source_id_project_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "ingestion_runs" ALTER COLUMN "source_id" SET DATA TYPE text;
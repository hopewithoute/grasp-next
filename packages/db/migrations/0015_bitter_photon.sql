CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
DROP TABLE IF EXISTS "wiki_concept_sections" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "wiki_section_source_refs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "wiki_sections" CASCADE;--> statement-breakpoint
ALTER TABLE "knowledgebase_versions" DROP CONSTRAINT IF EXISTS "knowledgebase_versions_artifact_version_id_artifact_versions_id_fk";
--> statement-breakpoint
ALTER TABLE "knowledgebases" DROP CONSTRAINT IF EXISTS "knowledgebases_artifact_id_artifacts_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "knowledgebase_versions_artifact_version_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "knowledgebases_artifact_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "wiki_concepts_version_key_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "wiki_relationships_version_key_unique";--> statement-breakpoint
ALTER TABLE "artifact_versions" ALTER COLUMN "extraction_mode" SET DEFAULT 'llm_json';--> statement-breakpoint
ALTER TABLE "knowledgebase_versions" ALTER COLUMN "artifact_version_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledgebases" ALTER COLUMN "artifact_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wiki_concepts" ALTER COLUMN "knowledgebase_version_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wiki_relationships" ALTER COLUMN "knowledgebase_version_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledgebase_versions" ADD CONSTRAINT "knowledgebase_versions_artifact_version_id_artifact_versions_id_fk" FOREIGN KEY ("artifact_version_id") REFERENCES "public"."artifact_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledgebases" ADD CONSTRAINT "knowledgebases_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wiki_concept_refs_quote_trgm_idx" ON "wiki_concept_source_refs" USING gin ("quote" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wiki_concepts_kb_key_unique" ON "wiki_concepts" USING btree ("knowledgebase_id","concept_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wiki_concepts_name_trgm_idx" ON "wiki_concepts" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wiki_concepts_def_trgm_idx" ON "wiki_concepts" USING gin ("definition" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wiki_relationships_kb_key_unique" ON "wiki_relationships" USING btree ("knowledgebase_id","relationship_key");

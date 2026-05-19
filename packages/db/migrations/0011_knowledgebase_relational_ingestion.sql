CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."ingestion_run_status" AS ENUM('ingesting', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."knowledgebase_version_status" AS ENUM('generated', 'approved', 'needs_revision');--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_id" uuid,
	"status" "ingestion_run_status" DEFAULT 'ingesting' NOT NULL,
	"failure_reason" text,
	"metadata" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledgebase_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledgebase_id" uuid NOT NULL,
	"artifact_version_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" "knowledgebase_version_status" DEFAULT 'generated' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledgebases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"artifact_id" uuid NOT NULL,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_passages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"block_id" text NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"location" jsonb NOT NULL,
	"metadata" jsonb,
	"order" integer NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_concept_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"concept_id" uuid NOT NULL,
	"section_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_concept_source_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"concept_id" uuid NOT NULL,
	"source_passage_id" uuid NOT NULL,
	"quote" text NOT NULL,
	"location_label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledgebase_id" uuid NOT NULL,
	"knowledgebase_version_id" uuid NOT NULL,
	"concept_key" text NOT NULL,
	"name" text NOT NULL,
	"definition" text NOT NULL,
	"difficulty" text NOT NULL,
	"confidence" real NOT NULL,
	"metadata" jsonb,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_relationship_source_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"source_passage_id" uuid NOT NULL,
	"quote" text NOT NULL,
	"location_label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledgebase_id" uuid NOT NULL,
	"knowledgebase_version_id" uuid NOT NULL,
	"relationship_key" text NOT NULL,
	"source_concept_id" uuid NOT NULL,
	"target_concept_id" uuid NOT NULL,
	"relationship_type" text NOT NULL,
	"rationale" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_section_source_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"source_passage_id" uuid NOT NULL,
	"quote" text NOT NULL,
	"location_label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledgebase_id" uuid NOT NULL,
	"knowledgebase_version_id" uuid NOT NULL,
	"section_key" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb,
	"order" integer NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_source_id_project_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."project_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledgebase_versions" ADD CONSTRAINT "knowledgebase_versions_knowledgebase_id_knowledgebases_id_fk" FOREIGN KEY ("knowledgebase_id") REFERENCES "public"."knowledgebases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledgebase_versions" ADD CONSTRAINT "knowledgebase_versions_artifact_version_id_artifact_versions_id_fk" FOREIGN KEY ("artifact_version_id") REFERENCES "public"."artifact_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledgebases" ADD CONSTRAINT "knowledgebases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledgebases" ADD CONSTRAINT "knowledgebases_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_passages" ADD CONSTRAINT "source_passages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_passages" ADD CONSTRAINT "source_passages_source_id_project_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."project_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_concept_sections" ADD CONSTRAINT "wiki_concept_sections_concept_id_wiki_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."wiki_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_concept_sections" ADD CONSTRAINT "wiki_concept_sections_section_id_wiki_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."wiki_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_concept_source_refs" ADD CONSTRAINT "wiki_concept_source_refs_concept_id_wiki_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."wiki_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_concept_source_refs" ADD CONSTRAINT "wiki_concept_source_refs_source_passage_id_source_passages_id_fk" FOREIGN KEY ("source_passage_id") REFERENCES "public"."source_passages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_concepts" ADD CONSTRAINT "wiki_concepts_knowledgebase_id_knowledgebases_id_fk" FOREIGN KEY ("knowledgebase_id") REFERENCES "public"."knowledgebases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_concepts" ADD CONSTRAINT "wiki_concepts_knowledgebase_version_id_knowledgebase_versions_id_fk" FOREIGN KEY ("knowledgebase_version_id") REFERENCES "public"."knowledgebase_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_relationship_source_refs" ADD CONSTRAINT "wiki_relationship_source_refs_relationship_id_wiki_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."wiki_relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_relationship_source_refs" ADD CONSTRAINT "wiki_relationship_source_refs_source_passage_id_source_passages_id_fk" FOREIGN KEY ("source_passage_id") REFERENCES "public"."source_passages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_relationships" ADD CONSTRAINT "wiki_relationships_knowledgebase_id_knowledgebases_id_fk" FOREIGN KEY ("knowledgebase_id") REFERENCES "public"."knowledgebases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_relationships" ADD CONSTRAINT "wiki_relationships_knowledgebase_version_id_knowledgebase_versions_id_fk" FOREIGN KEY ("knowledgebase_version_id") REFERENCES "public"."knowledgebase_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_relationships" ADD CONSTRAINT "wiki_relationships_source_concept_id_wiki_concepts_id_fk" FOREIGN KEY ("source_concept_id") REFERENCES "public"."wiki_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_relationships" ADD CONSTRAINT "wiki_relationships_target_concept_id_wiki_concepts_id_fk" FOREIGN KEY ("target_concept_id") REFERENCES "public"."wiki_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_section_source_refs" ADD CONSTRAINT "wiki_section_source_refs_section_id_wiki_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."wiki_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_section_source_refs" ADD CONSTRAINT "wiki_section_source_refs_source_passage_id_source_passages_id_fk" FOREIGN KEY ("source_passage_id") REFERENCES "public"."source_passages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_sections" ADD CONSTRAINT "wiki_sections_knowledgebase_id_knowledgebases_id_fk" FOREIGN KEY ("knowledgebase_id") REFERENCES "public"."knowledgebases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_sections" ADD CONSTRAINT "wiki_sections_knowledgebase_version_id_knowledgebase_versions_id_fk" FOREIGN KEY ("knowledgebase_version_id") REFERENCES "public"."knowledgebase_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingestion_runs_project_idx" ON "ingestion_runs" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledgebase_versions_version_unique" ON "knowledgebase_versions" USING btree ("knowledgebase_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledgebase_versions_artifact_version_unique" ON "knowledgebase_versions" USING btree ("artifact_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledgebases_project_unique" ON "knowledgebases" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledgebases_artifact_unique" ON "knowledgebases" USING btree ("artifact_id");--> statement-breakpoint
CREATE INDEX "source_passages_project_idx" ON "source_passages" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_passages_source_block_unique" ON "source_passages" USING btree ("source_id","block_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_concept_sections_unique" ON "wiki_concept_sections" USING btree ("concept_id","section_id");--> statement-breakpoint
CREATE INDEX "wiki_concepts_knowledgebase_idx" ON "wiki_concepts" USING btree ("knowledgebase_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_concepts_version_key_unique" ON "wiki_concepts" USING btree ("knowledgebase_version_id","concept_key");--> statement-breakpoint
CREATE INDEX "wiki_relationships_knowledgebase_idx" ON "wiki_relationships" USING btree ("knowledgebase_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_relationships_version_key_unique" ON "wiki_relationships" USING btree ("knowledgebase_version_id","relationship_key");--> statement-breakpoint
CREATE INDEX "wiki_sections_knowledgebase_idx" ON "wiki_sections" USING btree ("knowledgebase_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_sections_version_key_unique" ON "wiki_sections" USING btree ("knowledgebase_version_id","section_key");

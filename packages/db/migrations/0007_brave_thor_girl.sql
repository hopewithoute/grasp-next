CREATE TYPE "public"."artifact_review_run_status" AS ENUM('suspended', 'resumed', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "artifact_review_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_id" uuid NOT NULL,
	"artifact_version_id" uuid NOT NULL,
	"workflow_id" text NOT NULL,
	"workflow_run_id" text NOT NULL,
	"resume_label" text NOT NULL,
	"suspended_steps" jsonb NOT NULL,
	"resume_labels" jsonb,
	"status" "artifact_review_run_status" DEFAULT 'suspended' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifact_review_runs" ADD CONSTRAINT "artifact_review_runs_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_review_runs" ADD CONSTRAINT "artifact_review_runs_artifact_version_id_artifact_versions_id_fk" FOREIGN KEY ("artifact_version_id") REFERENCES "public"."artifact_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "artifact_review_runs_artifact_version_unique" ON "artifact_review_runs" USING btree ("artifact_version_id");
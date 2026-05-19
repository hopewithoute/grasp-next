CREATE TYPE "project_source_type" AS ENUM('markdown', 'text', 'pdf', 'video', 'web');

CREATE TABLE "project_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "type" "project_source_type" NOT NULL,
  "title" text NOT NULL,
  "content" text,
  "file_ref" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "project_sources"
ADD CONSTRAINT "project_sources_project_id_projects_id_fk"
FOREIGN KEY ("project_id") REFERENCES "projects"("id")
ON DELETE cascade
ON UPDATE no action;

INSERT INTO "project_sources" (
  "project_id",
  "type",
  "title",
  "content",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  'markdown'::"project_source_type",
  'Initial source',
  "source_material",
  "created_at",
  "updated_at"
FROM "projects"
WHERE NULLIF(BTRIM("source_material"), '') IS NOT NULL;

ALTER TABLE "projects" DROP COLUMN "source_material";

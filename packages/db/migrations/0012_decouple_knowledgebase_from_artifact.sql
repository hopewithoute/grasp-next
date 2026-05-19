-- Decouple knowledgebase tables from artifact tables.
-- Make artifact references nullable and drop unique constraints that enforce the coupling.

-- knowledgebases: make artifact_id nullable, drop unique index
DROP INDEX IF EXISTS "knowledgebases_artifact_unique";
ALTER TABLE "knowledgebases" ALTER COLUMN "artifact_id" DROP NOT NULL;
ALTER TABLE "knowledgebases" DROP CONSTRAINT IF EXISTS "knowledgebases_artifact_id_artifacts_id_fk";
ALTER TABLE "knowledgebases" ADD CONSTRAINT "knowledgebases_artifact_id_artifacts_id_fk"
  FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE SET NULL;

-- knowledgebase_versions: make artifact_version_id nullable, drop unique index
DROP INDEX IF EXISTS "knowledgebase_versions_artifact_version_unique";
ALTER TABLE "knowledgebase_versions" ALTER COLUMN "artifact_version_id" DROP NOT NULL;
ALTER TABLE "knowledgebase_versions" DROP CONSTRAINT IF EXISTS "knowledgebase_versions_artifact_version_id_artifact_versions_id_fk";
ALTER TABLE "knowledgebase_versions" ADD CONSTRAINT "knowledgebase_versions_artifact_version_id_artifact_versions_id_fk"
  FOREIGN KEY ("artifact_version_id") REFERENCES "artifact_versions"("id") ON DELETE SET NULL;

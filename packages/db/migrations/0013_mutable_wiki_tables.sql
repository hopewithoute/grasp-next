-- Make wiki tables mutable at the knowledgebase level.
-- knowledgebase_version_id becomes nullable (null = live mutable row).
-- Add knowledgebase-level unique indexes for upsert by conceptKey/sectionKey/relationshipKey.

-- wiki_concepts: drop version-scoped unique, add kb-scoped unique
DROP INDEX IF EXISTS "wiki_concepts_version_key_unique";
ALTER TABLE "wiki_concepts" ALTER COLUMN "knowledgebase_version_id" DROP NOT NULL;
CREATE UNIQUE INDEX "wiki_concepts_kb_key_unique"
  ON "wiki_concepts" ("knowledgebase_id", "concept_key");

-- wiki_sections: drop version-scoped unique, add kb-scoped unique
DROP INDEX IF EXISTS "wiki_sections_version_key_unique";
ALTER TABLE "wiki_sections" ALTER COLUMN "knowledgebase_version_id" DROP NOT NULL;
CREATE UNIQUE INDEX "wiki_sections_kb_key_unique"
  ON "wiki_sections" ("knowledgebase_id", "section_key");

-- wiki_relationships: drop version-scoped unique, add kb-scoped unique
DROP INDEX IF EXISTS "wiki_relationships_version_key_unique";
ALTER TABLE "wiki_relationships" ALTER COLUMN "knowledgebase_version_id" DROP NOT NULL;
CREATE UNIQUE INDEX "wiki_relationships_kb_key_unique"
  ON "wiki_relationships" ("knowledgebase_id", "relationship_key");

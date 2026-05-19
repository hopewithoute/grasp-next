-- Drop legacy section tables. Sections were never wired to the active LLM ingestion path
-- and no UI surface consumes them. Concepts retain their grounding via wiki_concept_source_refs.

DROP TABLE IF EXISTS "wiki_section_source_refs" CASCADE;
DROP TABLE IF EXISTS "wiki_concept_sections" CASCADE;
DROP TABLE IF EXISTS "wiki_sections" CASCADE;

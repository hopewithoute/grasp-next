import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import {
  chunkNormalizedBlocks,
  ingestionAgentOutputDto,
  normalizeMarkdownSource,
  type IngestionAgentOutput,
} from '@grasp/domain';
import { extractChunk, mergeDraft } from './extract-chunk';

const DOCS_DIR = resolve(import.meta.dirname, '../../../../docs/example');

const sourceA = readFileSync(resolve(DOCS_DIR, 'source-a-economics-basics.md'), 'utf-8');
const sourceB = readFileSync(resolve(DOCS_DIR, 'source-b-elasticity.md'), 'utf-8');

const hasLlm = Boolean(
  process.env.OPENAI_API_KEY ||
  process.env.ANTHROPIC_API_KEY ||
  process.env.ANTHROPIC_AUTH_TOKEN ||
  (process.env.OPENAI_COMPATIBLE_BASE_URL && process.env.OPENAI_COMPATIBLE_API_KEY)
);

const describeIfLlm = hasLlm ? describe : describe.skip;

describeIfLlm('ingestion extraction (real agent)', () => {
  it('case 1: fresh source — no existing concepts', async () => {
    const sourceId = 'src-a';
    const normalized = normalizeMarkdownSource({
      sourceId,
      sourceMaterial: sourceA,
      title: 'Economics Basics',
    });

    const chunks = chunkNormalizedBlocks(normalized.blocks);
    assert.ok(chunks.length >= 1, `Expected at least 1 chunk, got ${chunks.length}`);

    let draft: IngestionAgentOutput = { concepts: [], relationClaims: [], relationships: [] };

    for (const chunk of chunks) {
      const result = await extractChunk({
        blocks: chunk.blocks.map((b) => ({ id: b.id, text: b.text })),
        chunkIndex: chunk.chunkIndex,
        draftConcepts: draft.concepts,
        draftRelationships: draft.relationships,
        sourceId,
        totalChunks: chunks.length,
      });

      if (result.concepts.length > 0) {
        draft = mergeDraft(draft, result);
      }
    }

    // Validate output shape
    const parsed = ingestionAgentOutputDto.safeParse(draft);
    assert.ok(parsed.success, `Output failed validation: ${JSON.stringify(parsed.error?.issues)}`);

    // Verify concepts were extracted
    assert.ok(draft.concepts.length >= 2, `Expected at least 2 concepts, got ${draft.concepts.length}`);

    // Verify each concept has required fields
    for (const concept of draft.concepts) {
      assert.ok(concept.conceptKey, `Concept missing conceptKey: ${JSON.stringify(concept)}`);
      assert.ok(concept.name, `Concept missing name: ${concept.conceptKey}`);
      assert.ok(concept.definition, `Concept missing definition: ${concept.conceptKey}`);
      assert.ok(concept.sourceRefs.length > 0, `Concept has no sourceRefs: ${concept.conceptKey}`);
      assert.ok(
        concept.confidence >= 0 && concept.confidence <= 1,
        `Confidence out of range: ${concept.confidence}`
      );
    }

    // Verify sourceRefs quote from actual text
    for (const concept of draft.concepts) {
      for (const ref of concept.sourceRefs) {
        assert.ok(ref.blockId, `sourceRef missing blockId for concept ${concept.conceptKey}`);
        assert.ok(ref.quote, `sourceRef missing quote for concept ${concept.conceptKey}`);
        assert.ok(ref.locationLabel, `sourceRef missing locationLabel for concept ${concept.conceptKey}`);
      }
    }

    console.log('\n=== Case 1: Fresh source ===');
    console.log(`Chunks: ${chunks.length}`);
    console.log(`Concepts: ${draft.concepts.length}`);
    console.log(`Relationships: ${draft.relationships.length}`);
    for (const c of draft.concepts) {
      console.log(`  [${c.conceptKey}] ${c.name} (${c.difficulty}, ${c.confidence})`);
    }
    for (const r of draft.relationships) {
      console.log(`  ${r.sourceConceptKey} → ${r.targetConceptKey} (${r.relationshipType})`);
    }
  });

  it('case 2: incremental source — existing concepts from source A', async () => {
    // First, extract from source A to get existing concepts
    const sourceIdA = 'src-a';
    const normalizedA = normalizeMarkdownSource({
      sourceId: sourceIdA,
      sourceMaterial: sourceA,
      title: 'Economics Basics',
    });
    const chunksA = chunkNormalizedBlocks(normalizedA.blocks);

    let draftA: IngestionAgentOutput = { concepts: [], relationClaims: [], relationships: [] };
    for (const chunk of chunksA) {
      const result = await extractChunk({
        blocks: chunk.blocks.map((b) => ({ id: b.id, text: b.text })),
        chunkIndex: chunk.chunkIndex,
        draftConcepts: draftA.concepts,
        draftRelationships: draftA.relationships,
        sourceId: sourceIdA,
        totalChunks: chunksA.length,
      });
      if (result.concepts.length > 0) {
        draftA = mergeDraft(draftA, result);
      }
    }

    // Now ingest source B. DB-wide existing concepts are retrieved by tools in the web runner;
    // this direct agent test only carries same-run draft concepts.
    const sourceIdB = 'src-b';
    const normalizedB = normalizeMarkdownSource({
      sourceId: sourceIdB,
      sourceMaterial: sourceB,
      title: 'Elasticity',
    });
    const chunksB = chunkNormalizedBlocks(normalizedB.blocks);

    let draftB: IngestionAgentOutput = { concepts: [], relationClaims: [], relationships: [] };
    for (const chunk of chunksB) {
      const result = await extractChunk({
        blocks: chunk.blocks.map((b) => ({ id: b.id, text: b.text })),
        chunkIndex: chunk.chunkIndex,
        draftConcepts: draftB.concepts,
        draftRelationships: draftB.relationships,
        sourceId: sourceIdB,
        totalChunks: chunksB.length,
      });
      if (result.concepts.length > 0) {
        draftB = mergeDraft(draftB, result);
      }
    }

    // Validate output shape
    const parsed = ingestionAgentOutputDto.safeParse(draftB);
    assert.ok(parsed.success, `Output failed validation: ${JSON.stringify(parsed.error?.issues)}`);

    // Verify new concepts were extracted
    assert.ok(draftB.concepts.length >= 1, `Expected at least 1 concept, got ${draftB.concepts.length}`);

    // This direct test has no retrieval tools, so compare with source A only for reporting.
    const existingKeys = new Set(draftA.concepts.map((c) => c.conceptKey));
    const reusedKeys = draftB.concepts.filter(
      (c) => existingKeys.has(c.conceptKey) || (c.mergesWith && existingKeys.has(c.mergesWith))
    );
    const newKeys = draftB.concepts.filter(
      (c) => !existingKeys.has(c.conceptKey) && !(c.mergesWith && existingKeys.has(c.mergesWith))
    );

    console.log('\n=== Case 2: Incremental source ===');
    console.log(`Concepts from A: ${draftA.concepts.length}`);
    console.log(`  ${draftA.concepts.map((c) => c.conceptKey).join(', ')}`);
    console.log(`Chunks in B: ${chunksB.length}`);
    console.log(`Concepts from B: ${draftB.concepts.length}`);
    console.log(`  Reused/merged: ${reusedKeys.length}`);
    for (const c of reusedKeys) {
      console.log(`    [${c.conceptKey}]${c.mergesWith ? ` (mergesWith: ${c.mergesWith})` : ''} ${c.name}`);
    }
    console.log(`  New: ${newKeys.length}`);
    for (const c of newKeys) {
      console.log(`    [${c.conceptKey}] ${c.name}`);
    }
    console.log(`Relationships: ${draftB.relationships.length}`);
    for (const r of draftB.relationships) {
      console.log(`  ${r.sourceConceptKey} → ${r.targetConceptKey}`);
    }

    // Verify the merged state makes sense
    const finalDraft = mergeDraft(
      {
        concepts: draftA.concepts,
        relationClaims: draftA.relationClaims,
        relationships: draftA.relationships,
      },
      draftB
    );

    console.log(`\n=== Final merged KB state ===`);
    console.log(`Total concepts: ${finalDraft.concepts.length}`);
    for (const c of finalDraft.concepts) {
      console.log(`  [${c.conceptKey}] ${c.name} — refs: ${c.sourceRefs.length}`);
    }
    console.log(`Total relationships: ${finalDraft.relationships.length}`);
  });
});

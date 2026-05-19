export function buildIngestionPrompt(input: {
  blocks: Array<{ id: string; text: string }>;
  chunkIndex: number;
  totalChunks: number;
  sourceId: string;
  draftConcepts: Array<{ conceptKey: string; name: string; definition: string }>;
}) {
  const draftSection = input.draftConcepts.length
    ? `
## Draft Concepts (from earlier chunks of this source)

Reuse their conceptKey to enrich. Only create new keys for genuinely new topics.

${input.draftConcepts.map((c) => `- \`${c.conceptKey}\`: "${c.name}" — ${c.definition}`).join('\n')}
`
    : '';

  const blocksSection = input.blocks
    .map((block) => `### ${block.id}\n${block.text}`)
    .join('\n\n');

  return `You are a knowledge extraction agent. Process the chunk below in two phases.

## PHASE 1: THINKING (output your reasoning in a <thinking> block)

Before producing JSON, reason through these steps:

1. **Scan for teachable concepts** — What distinct ideas does a learner need to understand from this chunk?
2. **Deduplication check** — For each candidate concept, check: does it overlap >70% with an existing or draft concept? If yes, reuse that conceptKey and enrich its definition. Prefer fewer rich concepts over many thin ones.
3. **Granularity check** — Is this concept substantial enough to stand alone, or is it just a detail of a broader concept? If it's a sub-detail, fold it into the parent concept's definition.
4. **Prerequisite reasoning** — Does the text explicitly state that understanding X is needed before Y? Only mark prerequisites when the text supports ordering (e.g. "builds on", "requires understanding of", "extends"). Do NOT infer prerequisites from topic order alone.
5. **Evidence selection** — For each concept, pick the block whose text directly supports it and copy a verbatim quote from that block. The quote must be an exact substring of the block text. If you cannot find a verbatim quote, do not include that sourceRef.

## PHASE 2: JSON OUTPUT (after </thinking>)

Output valid JSON with this shape:
- concepts[]: conceptKey, name, definition, difficulty, confidence, sourceRefs[], mergesWith?
- relationships[]: sourceConceptKey, targetConceptKey, relationshipType, rationale?, sourceRefs[]

## Rules

- conceptKey: lowercase slug (e.g. "supply-demand", "price-elasticity")
- If concept matches existing/draft: reuse its conceptKey (= UPDATE with enriched definition)
- If concept is same as existing but named differently: set mergesWith to existing conceptKey
- Before creating a new concept, use search-wiki-concepts when the candidate could overlap with an existing knowledgebase concept.
- When search-wiki-concepts returns a likely match, use get-concept-context before deciding whether to reuse, merge, or create.
- sourceRefs.quote: MUST be an exact substring from a block below. No paraphrasing. Copy character-for-character. Quotes that aren't found verbatim in any block will be dropped server-side and concepts without grounded quotes will be dropped entirely.
- sourceRefs.blockId: MUST match one of the block IDs listed below (the \`### block-NNNN\` headers).
- confidence: 0-1 based on how strongly the chunk supports this concept (0.9+ = explicitly taught, 0.6-0.8 = mentioned, <0.6 = implied)
- difficulty: beginner (foundational), intermediate (requires context), advanced (specialized)
- Do NOT invent information not present in the chunk
- Aim for 2-6 concepts per chunk. More than 6 usually means over-splitting.
${draftSection}
## Chunk ${input.chunkIndex + 1} of ${input.totalChunks} (sourceId: ${input.sourceId})

The chunk is split into blocks. Use the block IDs in your sourceRefs.

${blocksSection}

---

Now begin with <thinking> then output JSON after </thinking>.`;
}

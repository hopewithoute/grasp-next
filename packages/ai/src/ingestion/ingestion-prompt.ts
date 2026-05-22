export function buildIngestionPrompt(input: {
  blocks: Array<{ id: string; text: string }>;
  chunkIndex: number;
  totalChunks: number;
  sourceId: string;
  draftConcepts: Array<{ conceptKey: string; name: string; definition: string }>;
  retrievedConcepts?: Array<{
    conceptKey: string;
    definition: string;
    name: string;
    neighbors: Array<{
      conceptKey: string;
      direction: 'incoming' | 'outgoing';
      name: string;
      relationshipType: string;
    }>;
  }>;
}) {
  const draftSection = input.draftConcepts.length
    ? `
## Draft Concepts (from earlier chunks of this source)

Reuse their conceptKey to enrich. Only create new keys for genuinely new topics.

${input.draftConcepts.map((c) => `- \`${c.conceptKey}\`: "${c.name}" — ${c.definition}`).join('\n')}
`
    : '';
  const retrievedSection = input.retrievedConcepts?.length
    ? `
## Retrieved Graph Context

These concepts were retrieved from the existing project knowledgebase using semantic search over graph concept embeddings. Reuse or merge with them when the chunk overlaps, and use their neighbors to avoid duplicate or incoherent relationships.

${input.retrievedConcepts.map((concept) => {
  const neighbors = concept.neighbors.length
    ? concept.neighbors
        .map(
          (neighbor) =>
            `${neighbor.direction} ${neighbor.relationshipType}: \`${neighbor.conceptKey}\` (${neighbor.name})`
        )
        .join('; ')
    : 'no known neighbors';

  return `- \`${concept.conceptKey}\`: "${concept.name}" — ${concept.definition} | ${neighbors}`;
}).join('\n')}
`
    : '';

  const blocksSection = input.blocks
    .map((block) => `### ${block.id}\n${block.text}`)
    .join('\n\n');

  return `You are a knowledge extraction agent. Return exactly one valid JSON object.

Before producing JSON, silently reason through these steps:

1. **Scan for teachable concepts** — What distinct ideas does a learner need to understand from this chunk?
2. **Deduplication check** — For each candidate concept, check: does it overlap >70% with an existing or draft concept? If yes, reuse that conceptKey and enrich its definition. Prefer fewer rich concepts over many thin ones.
3. **Granularity check** — Is this concept substantial enough to stand alone, or is it just a detail of a broader concept? If it's a sub-detail, fold it into the parent concept's definition.
4. **Relation reasoning** — Does the text explicitly connect two concepts? Classify only source-backed relationships. Do NOT infer relationships from topic order alone.
5. **Evidence selection** — For each concept, pick the block whose text directly supports it and copy a verbatim quote from that block. The quote must be an exact substring of the block text. If you cannot find a verbatim quote, do not include that sourceRef.

## JSON Output

Output only valid JSON with this shape:
- concepts[]: conceptKey, name, definition, difficulty, confidence, sourceRefs[], mergesWith?
- relationClaims[]: subjectText, predicate, objectText, sourceRefs[]
- relationships[]: sourceConceptKey, targetConceptKey, relationshipType, rationale?, sourceRefs[]

## Rules

- conceptKey: lowercase slug (e.g. "supply-demand", "price-elasticity")
- If concept matches existing/draft: reuse its conceptKey (= UPDATE with enriched definition)
- If concept is same as existing but named differently: set mergesWith to existing conceptKey
- When retrieval tools are available, you MUST call search-wiki-concepts at least once before final JSON if the chunk mentions any concept that could overlap with the existing knowledgebase.
- When search-wiki-concepts returns a likely match, you MUST call get-concept-context before deciding whether to reuse, merge, or create.
- Use get-concept-neighbors before adding a typed relationship involving an existing concept when the relationship may already exist nearby.
- relationshipType MUST be one of: "prerequisite", "part_of", "related_to", "explains".
- Use "prerequisite" when the source says one concept builds on, requires, extends, or should be understood before another. sourceConceptKey is the prior concept; targetConceptKey is the concept that builds on it.
- Use "part_of" when one concept is a component, law, determinant, or subtopic of a broader concept. sourceConceptKey is the part; targetConceptKey is the whole.
- Use "explains" when one concept helps explain another but is not strictly prior knowledge.
- Use "related_to" only for explicit connections that are source-backed but not prerequisite, part_of, or explains.
- Add relationClaims for source statements that connect a local concept to another named idea, especially phrases like "builds on", "requires", "depends on", "part of", "explains", or "connects to". Use predicate "builds_on" for "builds on foundational concepts of X".
- sourceRefs.quote: MUST be an exact substring from a block below. No paraphrasing. Copy character-for-character. Quotes that aren't found verbatim in any block will be dropped server-side and concepts without grounded quotes will be dropped entirely.
- sourceRefs.blockId: MUST match one of the block IDs listed below (the \`### block-NNNN\` headers).
- confidence: 0-1 based on how strongly the chunk supports this concept (0.9+ = explicitly taught, 0.6-0.8 = mentioned, <0.6 = implied)
- difficulty: beginner (foundational), intermediate (requires context), advanced (specialized)
- Do NOT invent information not present in the chunk
- Aim for 2-6 concepts per chunk. More than 6 usually means over-splitting.
- Keep definitions and rationales concise. Output complete JSON only; never truncate.
${draftSection}
${retrievedSection}
## Chunk ${input.chunkIndex + 1} of ${input.totalChunks} (sourceId: ${input.sourceId})

The chunk is split into blocks. Use the block IDs in your sourceRefs.

${blocksSection}

---

Return only the JSON object. Do not include markdown fences, prose, or separate reasoning text.`;
}

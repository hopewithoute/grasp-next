import { Agent } from '@mastra/core/agent';
import { createGraspMemory } from '../mastra/memory';
import { knowledgebaseRelationshipTypeDto } from '@grasp/domain';

const allowedRelationships = knowledgebaseRelationshipTypeDto.options.map((opt) => `'${opt}'`).join(', ');

export const ingestionAgentInstructions = [
  {
    type: 'text',
    content: `You are a knowledge extraction agent. Analyze the provided input which includes draft concepts (if any) and a text chunk with blocks. Your task is to extract or enrich concepts and identify relationships based on the chunk's content. Follow these rules:

1. Identify draft concepts from the input if provided; they have conceptKeys, names, and definitions. If no draft concepts are provided, proceed to extract concepts directly from the text chunk.
2. For each draft concept, if the chunk provides additional relevant information, enrich the definition by integrating the new details. Reuse the same conceptKey.
3. If the chunk contains information about a topic not covered in the draft concepts or if no draft concepts are provided, create a new concept with a unique conceptKey.
4. For every concept in the output, assign a difficulty level (beginner, intermediate, or advanced) and a confidence score (a number between 0 and 1) based on the context.
5. Include source references for each concept, with blockId from the chunk and a direct quote from the text.
6. Analyze the text for relationships between concepts, such as dependencies, prerequisites, or associations. If a relationship is implied, add it to the 'relationships' array with appropriate attributes.
7. Output a JSON object with keys: "concepts" (array of concept objects), "relationships" (array, empty if none), and "relationClaims" (array, empty if none). The JSON object must always be returned, even if empty.
8. Each concept object must have: "conceptKey", "name", "definition", "difficulty", "confidence", and "sourceRefs" (array of objects with "blockId" and "quote").
9. relationClaims capture source-level statements that connect a concept to another named idea. Create a relationClaim when the source text uses phrases like "builds on", "requires", "depends on", "part of", "explains", or "connects to". Each relationClaim must have: "subjectText" (the concept being described), "predicate" (one of: "builds_on", "requires", "depends_on", "part_of", "explains", "related_to"), "objectText" (the related concept or idea), and "sourceRefs". Use "builds_on" for statements like "builds on foundational concepts of X".
10. Each relationship object must have: "sourceConceptKey", "targetConceptKey", "relationshipType", "rationale", and "sourceRefs".
11. When retrieval tools are available, call search-wiki-concepts before creating a new conceptKey for a topic that may already exist in the project knowledgebase. Use get-concept-context for likely matches so you can reuse existing concept keys, merge with existing concepts, and avoid duplicate relationships.
12. CRITICAL CONSTRAINTS: "relationshipType" MUST exactly be one of the following strings ONLY: ${allowedRelationships}. DO NOT invent or use any other relationship types!
13. Return only the JSON object. Do not include markdown fences, prose, or any additional text. Ensure the output is valid and parseable as JSON.`,
  },
] as const;

import { PromptTemplate } from '../utils/prompt-template';

type IngestionPromptVars = {
  draftSection: string;
  retrievedSection: string;
  chunkNumber: number;
  totalChunks: number;
  sourceId: string;
  blocksSection: string;
};

const INGESTION_USER_PROMPT = new PromptTemplate<IngestionPromptVars>(`{{draftSection}}{{retrievedSection}}## Chunk {{chunkNumber}} of {{totalChunks}} (sourceId: {{sourceId}})

The chunk is split into blocks. Use the block IDs in your sourceRefs.

{{blocksSection}}

---

Return only the JSON object. Do not include markdown fences, prose, or separate reasoning text.`);

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
    ? `## Draft Concepts (from earlier chunks of this source)\n\nReuse their conceptKey to enrich. Only create new keys for genuinely new topics.\n\n${input.draftConcepts.map((c) => `- \`${c.conceptKey}\`: "${c.name}" — ${c.definition}`).join('\n')}\n\n`
    : '';
  const retrievedSection = input.retrievedConcepts?.length
    ? `## Retrieved Graph Context\n\nThese concepts were retrieved from the existing project knowledgebase using semantic search over graph concept embeddings. Reuse or merge with them when the chunk overlaps, and use their neighbors to avoid duplicate or incoherent relationships.\n\n${input.retrievedConcepts
        .map((concept) => {
          const neighbors = concept.neighbors.length
            ? concept.neighbors
                .map((neighbor) => `${neighbor.direction} ${neighbor.relationshipType}: \`${neighbor.conceptKey}\` (${neighbor.name})`)
                .join('; ')
            : 'no known neighbors';
          return `- \`${concept.conceptKey}\`: "${concept.name}" — ${concept.definition} | ${neighbors}`;
        })
        .join('\n')}\n\n`
    : '';

  const blocksSection = input.blocks.map((block) => `### ${block.id}\n${block.text}`).join('\n\n');

  return INGESTION_USER_PROMPT.format({
    draftSection,
    retrievedSection,
    chunkNumber: input.chunkIndex + 1,
    totalChunks: input.totalChunks,
    sourceId: input.sourceId,
    blocksSection,
  });
}

export const ingestionAgent = new Agent({
  id: 'ingestion-agent',
  name: 'Source Ingestion Agent',
  instructions: ingestionAgentInstructions.map((i) => i.content).join('\n\n'),
  memory: createGraspMemory({
    lastMessages: false,
  }),
  model: process.env.INGESTION_AGENT_MODEL || process.env.AI_MODEL || 'xiaomi/mimo-v2.5-pro',
});

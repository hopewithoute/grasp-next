import { createTool } from '@mastra/core/tools';
import { requiredString, v, type KnowledgebaseRepository } from '@grasp/domain';

const described = <TSchema extends v.GenericSchema>(schema: TSchema, description: string) =>
  v.pipe(schema, v.description(description));

const confidenceInputSchema = described(
  v.union([v.number(), v.string()]),
  'Confidence score between 0.0 and 1.0.'
);

/**
 * AI-facing schemas for the refinement agent's graph proposal tool.
 *
 * These schemas mirror the domain proposal DTOs in `@grasp/domain/refinement/proposal.dto.ts`
 * but are kept separate because:
 * 1. Domain DTOs preprocess robust inputs (e.g., "HIGH" → 0.9).
 * 2. AI schemas need descriptions on each field for LLM tool-use context.
 * 3. The AI schemas accept number|string for confidence,
 *    while domain DTOs preprocess strings to numbers.
 *
 * Both layers are needed: AI schemas shape LLM output, domain DTOs validate before DB writes.
 * If you change a field name or type here, update the corresponding domain DTO too.
 */

export const AddConceptSchema = v.object({
  type: v.literal('add_concept'),
  payload: v.object({
    conceptKey: described(v.string(), 'Exact URL-friendly unique key (kebab-case).'),
    name: described(v.string(), 'Human readable name of the concept.'),
    definition: described(v.string(), 'Clear, concise definition of the concept.'),
    difficulty: described(v.string(), 'Must be: beginner, intermediate, or advanced.'),
    confidence: confidenceInputSchema,
  }),
});

export const UpdateConceptSchema = v.object({
  type: v.literal('update_concept'),
  payload: v.object({
    conceptKey: described(
      v.string(),
      'The EXACT key of the existing concept to update. For multiple updates, create multiple update_concept actions.'
    ),
    name: v.optional(v.string()),
    definition: v.optional(v.string()),
    difficulty: v.optional(v.string()),
    confidence: v.optional(confidenceInputSchema),
    metadata: described(
      v.optional(v.record(v.string(), v.unknown())),
      'Arbitrary key-value metadata for the concept.'
    ),
  }),
});

export const DeleteConceptSchema = v.object({
  type: v.literal('delete_concept'),
  payload: v.object({
    conceptKey: described(
      v.string(),
      'The EXACT key of the concept to delete. To delete multiple concepts, create multiple separate delete_concept actions.'
    ),
  }),
});

export const AddRelationshipSchema = v.object({
  type: v.literal('add_relationship'),
  payload: v.object({
    sourceConceptKey: described(v.string(), 'The EXACT key of the source concept.'),
    targetConceptKey: described(v.string(), 'The EXACT key of the target concept.'),
    relationshipType: described(
      v.string(),
      'Must be: prerequisite, part_of, related_to, or explains.'
    ),
    rationale: described(v.string(), 'Explanation of why this relationship exists.'),
  }),
});

export const DeleteRelationshipSchema = v.object({
  type: v.literal('delete_relationship'),
  payload: v.object({
    sourceConceptKey: described(v.string(), 'The EXACT key of the source concept.'),
    targetConceptKey: described(v.string(), 'The EXACT key of the target concept.'),
    relationshipType: described(
      v.string(),
      'Must be: prerequisite, part_of, related_to, or explains.'
    ),
  }),
});

export const AddEvidenceSchema = v.object({
  type: v.literal('add_evidence'),
  payload: v.object({
    conceptKey: described(v.string(), 'The EXACT key of the concept this evidence supports.'),
    evidenceText: described(
      v.string(),
      'A direct quote or factual statement extracted from the source.'
    ),
    rationale: described(v.string(), 'Why this evidence proves the concept.'),
    url: described(v.optional(v.string()), 'Source URL if available.'),
    title: described(v.optional(v.string()), 'Title of the source document or webpage.'),
    sourceType: described(v.optional(v.string()), 'Must be "web" or "text".'),
  }),
});

export const UpdateEvidenceSchema = v.object({
  type: v.literal('update_evidence'),
  payload: v.object({
    evidenceId: described(v.string(), 'The EXACT ID of the evidence to update.'),
    evidenceText: described(
      v.optional(v.string()),
      'A direct quote or factual statement extracted from the source.'
    ),
    rationale: described(v.optional(v.string()), 'Why this evidence proves the concept.'),
  }),
});

export const DeleteEvidenceSchema = v.object({
  type: v.literal('delete_evidence'),
  payload: v.object({
    evidenceId: described(
      v.string(),
      'The EXACT ID of the evidence to delete. To delete multiple, create separate delete_evidence actions.'
    ),
  }),
});

export const GraphProposalActionSchema = v.variant('type', [
  AddConceptSchema,
  UpdateConceptSchema,
  DeleteConceptSchema,
  AddRelationshipSchema,
  DeleteRelationshipSchema,
  AddEvidenceSchema,
  UpdateEvidenceSchema,
  DeleteEvidenceSchema,
]);

export const GraphProposalSchema = v.object({
  rationale: described(v.string(), 'A short message explaining what you are changing and why.'),
  actions: v.array(GraphProposalActionSchema),
});

export type GraphProposalAction = v.InferOutput<typeof GraphProposalActionSchema>;
export type GraphProposalPayload = v.InferOutput<typeof GraphProposalSchema>;

export function createSearchWikiConceptsTool(deps: {
  knowledgebaseRepository: KnowledgebaseRepository;
  projectId: string;
}) {
  return createTool({
    id: 'search-wiki-concepts',
    description:
      'Search the concept graph to find existing nodes. You MUST use this tool before modifying, adding, or deleting concepts to retrieve their exact conceptKey and prevent duplicates.',
    inputSchema: v.object({
      limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)), 10),
      query: requiredString,
    }),
    outputSchema: v.object({
      concepts: v.array(
        v.object({
          conceptKey: v.string(),
          confidence: v.number(),
          definition: v.string(),
          difficulty: v.string(),
          evidenceCount: v.number(),
          name: v.string(),
          evidence: v.optional(
            v.array(
              v.object({
                id: v.string(),
                blockId: v.nullable(v.string()),
                excerpt: v.string(),
                location: v.nullable(v.string()),
                sourceId: v.string(),
              })
            )
          ),
        })
      ),
    }),
    execute: async ({ query, limit }, context) => {
      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Checking graph',
          detail: 'Looking for matching concepts in this project.',
          status: 'started',
        },
        transient: true,
      });

      const concepts = await deps.knowledgebaseRepository.searchConceptsForIngestion({
        projectId: deps.projectId,
        query,
        limit,
      });

      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Checked graph',
          detail: 'Found the closest existing concepts.',
          status: 'completed',
        },
        transient: true,
      });

      return { concepts };
    },
  });
}

export function createProposeGraphChangesTool() {
  return createTool({
    id: 'propose-graph-changes',
    description:
      'Propose structural changes to the graph. You MUST use this tool to execute any CREATE, UPDATE, or DELETE intent from the user. You are fully authorized to delete data this way. The changes only take effect after user approval.',
    inputSchema: GraphProposalSchema,
    execute: async (input, context) => {
      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Preparing proposal',
          detail: 'Drafting graph changes for your review.',
          status: 'started',
        },
        transient: true,
      });

      await context?.writer?.custom({
        type: 'data-agent-proposal',
        data: input,
      });

      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Proposal ready',
          detail: 'Proposal submitted for approval.',
          status: 'completed',
        },
        transient: true,
      });

      // Return the proposal directly. We do not save to DB here. The frontend intercepts this.
      return { status: 'proposal_submitted', proposal: input };
    },
  });
}

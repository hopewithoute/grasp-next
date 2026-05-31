import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { KnowledgebaseRepository } from '@grasp/domain';

/**
 * AI-facing schemas for the refinement agent's graph proposal tool.
 *
 * These schemas mirror the domain proposal DTOs in `@grasp/domain/refinement/proposal.dto.ts`
 * but are kept separate because:
 * 1. Domain DTOs use `z.preprocess()` for robustness (e.g., "HIGH" → 0.9) which is
 *    incompatible with Zod's `.extend()` and `.shape` APIs.
 * 2. AI schemas need `.describe()` on each field for LLM tool-use context.
 * 3. The AI schemas accept `z.union([z.number(), z.string()])` for confidence,
 *    while domain DTOs preprocess strings to numbers.
 *
 * Both layers are needed: AI schemas shape LLM output, domain DTOs validate before DB writes.
 * If you change a field name or type here, update the corresponding domain DTO too.
 */

export const AddConceptSchema = z.object({
  type: z.literal('add_concept'),
  payload: z.object({
    conceptKey: z.string().describe('Exact URL-friendly unique key (kebab-case).'),
    name: z.string().describe('Human readable name of the concept.'),
    definition: z.string().describe('Clear, concise definition of the concept.'),
    difficulty: z.string().describe('Must be: beginner, intermediate, or advanced.'),
    confidence: z
      .union([z.number(), z.string()])
      .describe('Confidence score between 0.0 and 1.0.'),
  }),
});

export const UpdateConceptSchema = z.object({
  type: z.literal('update_concept'),
  payload: z.object({
    conceptKey: z
      .string()
      .describe(
        'The EXACT key of the existing concept to update. For multiple updates, create multiple update_concept actions.'
      ),
    name: z.string().optional(),
    definition: z.string().optional(),
    difficulty: z.string().optional(),
    confidence: z
      .union([z.number(), z.string()])
      .optional()
      .describe('Confidence score between 0.0 and 1.0.'),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Arbitrary key-value metadata for the concept.'),
  }),
});

export const DeleteConceptSchema = z.object({
  type: z.literal('delete_concept'),
  payload: z.object({
    conceptKey: z
      .string()
      .describe(
        'The EXACT key of the concept to delete. To delete multiple concepts, create multiple separate delete_concept actions.'
      ),
  }),
});

export const AddRelationshipSchema = z.object({
  type: z.literal('add_relationship'),
  payload: z.object({
    sourceConceptKey: z.string().describe('The EXACT key of the source concept.'),
    targetConceptKey: z.string().describe('The EXACT key of the target concept.'),
    relationshipType: z
      .string()
      .describe('Must be: prerequisite, part_of, related_to, or explains.'),
    rationale: z.string().describe('Explanation of why this relationship exists.'),
  }),
});

export const DeleteRelationshipSchema = z.object({
  type: z.literal('delete_relationship'),
  payload: z.object({
    sourceConceptKey: z.string().describe('The EXACT key of the source concept.'),
    targetConceptKey: z.string().describe('The EXACT key of the target concept.'),
    relationshipType: z
      .string()
      .describe('Must be: prerequisite, part_of, related_to, or explains.'),
  }),
});

export const AddEvidenceSchema = z.object({
  type: z.literal('add_evidence'),
  payload: z.object({
    conceptKey: z
      .string()
      .describe('The EXACT key of the concept this evidence supports.'),
    evidenceText: z
      .string()
      .describe('A direct quote or factual statement extracted from the source.'),
    rationale: z.string().describe('Why this evidence proves the concept.'),
    url: z.string().optional().describe('Source URL if available.'),
    title: z.string().optional().describe('Title of the source document or webpage.'),
    sourceType: z.string().optional().describe('Must be "web" or "text".'),
  }),
});

export const UpdateEvidenceSchema = z.object({
  type: z.literal('update_evidence'),
  payload: z.object({
    evidenceId: z.string().describe('The EXACT ID of the evidence to update.'),
    evidenceText: z
      .string()
      .optional()
      .describe('A direct quote or factual statement extracted from the source.'),
    rationale: z.string().optional().describe('Why this evidence proves the concept.'),
  }),
});

export const DeleteEvidenceSchema = z.object({
  type: z.literal('delete_evidence'),
  payload: z.object({
    evidenceId: z
      .string()
      .describe(
        'The EXACT ID of the evidence to delete. To delete multiple, create separate delete_evidence actions.'
      ),
  }),
});

export const GraphProposalActionSchema = z.discriminatedUnion('type', [
  AddConceptSchema,
  UpdateConceptSchema,
  DeleteConceptSchema,
  AddRelationshipSchema,
  DeleteRelationshipSchema,
  AddEvidenceSchema,
  UpdateEvidenceSchema,
  DeleteEvidenceSchema,
]);

export const GraphProposalSchema = z.object({
  rationale: z.string().describe('A short message explaining what you are changing and why.'),
  actions: z.array(GraphProposalActionSchema),
});

export type GraphProposalAction = z.infer<typeof GraphProposalActionSchema>;
export type GraphProposalPayload = z.infer<typeof GraphProposalSchema>;

export function createSearchWikiConceptsTool(deps: {
  knowledgebaseRepository: KnowledgebaseRepository;
  projectId: string;
}) {
  return createTool({
    id: 'search-wiki-concepts',
    description:
      'Search the concept graph to find existing nodes. You MUST use this tool before modifying, adding, or deleting concepts to retrieve their exact conceptKey and prevent duplicates.',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(20).default(10),
      query: z.string().trim().min(1),
    }),
    outputSchema: z.object({
      concepts: z.array(
        z.object({
          conceptKey: z.string(),
          confidence: z.number(),
          definition: z.string(),
          difficulty: z.string(),
          evidenceCount: z.number(),
          name: z.string(),
          evidence: z
            .array(
              z.object({
                id: z.string(),
                blockId: z.string().nullable(),
                excerpt: z.string(),
                location: z.string().nullable(),
                sourceId: z.string(),
              })
            )
            .optional(),
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

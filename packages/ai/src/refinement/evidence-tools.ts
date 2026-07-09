import { createTool } from '@mastra/core/tools';
import { v } from '@grasp/domain';

const described = <TSchema extends v.GenericSchema>(schema: TSchema, description: string) =>
  v.pipe(schema, v.description(description));

// Minimal interface for the evidence-kb service.
// Defined here to avoid importing server-only code from apps/web.
export type EvidenceKbToolApi = {
  retrieveForOwner(request: {
    filters?: Record<string, unknown>;
    mode?: 'hybrid' | 'bm25_only' | 'vector_only';
    ownerId: string;
    projectId: string;
    query: string;
    topK?: number;
  }): Promise<{
    contexts: Array<{
      passage_id: string;
      source_id: string;
      text: string;
      score: number;
      final_rank: number;
      bm25_rank?: number | null;
      vector_rank?: number | null;
      rrf_score?: number | null;
      location: {
        page?: number | null;
        heading?: string | null;
        start_offset?: number | null;
        end_offset?: number | null;
      };
    }>;
    retrievalMode: string;
    retrievalRunId: string;
  }>;

  listSourcesForOwner(request: { ownerId: string; projectId: string }): Promise<
    Array<{
      id: string;
      title: string;
      source_type: string;
      status?: string;
      retrieval_enabled?: boolean;
      quality_warnings?: string[];
    }>
  >;

  inspectPassageForOwner(request: {
    ownerId: string;
    passageId: string;
    projectId: string;
  }): Promise<{
    id: string;
    text: string;
    status?: string;
    retrieval_enabled?: boolean;
    quality_score: number;
    quality_warnings?: string[];
    source_id: string;
    location: { page?: number | null; heading?: string | null };
  }>;

  getSurroundingPassagesForOwner(request: {
    ownerId: string;
    passageId: string;
    projectId: string;
    before?: number;
    after?: number;
  }): Promise<
    Array<{
      id: string;
      text: string;
      status?: string;
      retrieval_enabled?: boolean;
      quality_score: number;
      quality_warnings?: string[];
      source_id: string;
      location: { page?: number | null; heading?: string | null };
    }>
  >;

  applyCurationForOwner(request: {
    actions: Array<Record<string, unknown>>;
    ownerId: string;
    projectId: string;
  }): Promise<{
    results: Array<{ ok: boolean; action: unknown; error?: string }>;
  }>;

  findWeakPassagesForOwner(request: {
    limit?: number;
    minQualityScore?: number;
    ownerId: string;
    projectId: string;
  }): Promise<
    Array<{
      id: string;
      text: string;
      status?: string;
      retrieval_enabled?: boolean;
      quality_score: number;
      quality_warnings?: string[];
      source_id: string;
      location: { page?: number | null; heading?: string | null };
    }>
  >;

  findStaleSourcesForOwner(request: {
    limit?: number;
    ownerId: string;
    projectId: string;
  }): Promise<
    Array<{
      id: string;
      title: string;
      source_type: string;
      status?: string;
      retrieval_enabled?: boolean;
      quality_warnings?: string[];
    }>
  >;

  bulkCurationForOwner(request: {
    actions: Array<Record<string, unknown>>;
    ownerId: string;
    projectId: string;
  }): Promise<{
    results: Array<{ ok: boolean; action: unknown; error?: string }>;
    total: number;
    succeeded: number;
    failed: number;
  }>;

  exportPassagesForOwner(request: {
    ownerId: string;
    projectId: string;
    sourceId?: string;
    status?: string;
    format?: string;
  }): Promise<{
    passages: Array<{
      id: string;
      source_id: string;
      text: string;
      status?: string;
      quality_score: number;
      quality_warnings?: string[];
      retrieval_enabled?: boolean;
      token_count: number;
      location: Record<string, unknown>;
    }>;
    total: number;
  }>;
};

const CurationActionSchema = v.union([
  v.object({
    type: v.literal('certify_passage'),
    passageId: described(v.string(), 'The passage ID to certify.'),
  }),
  v.object({
    type: v.literal('reject_passage'),
    passageId: described(v.string(), 'The passage ID to reject.'),
  }),
  v.object({
    type: v.literal('set_passage_retrieval_enabled'),
    passageId: described(v.string(), 'The passage ID.'),
    enabled: described(v.boolean(), 'Whether retrieval is enabled.'),
  }),
  v.object({
    type: v.literal('add_quality_warning'),
    passageId: described(v.string(), 'The passage ID.'),
    warning: described(v.string(), 'Warning text to add.'),
  }),
  v.object({
    type: v.literal('clear_quality_warning'),
    passageId: described(v.string(), 'The passage ID.'),
    warning: v.optional(described(v.string(), 'Specific warning to clear. Omit to clear all.')),
  }),
]);

export const EvidenceCurationProposalSchema = v.object({
  rationale: described(v.string(), 'A short message explaining what you are curating and why.'),
  actions: v.array(CurationActionSchema),
});

export type EvidenceCurationProposal = v.InferOutput<typeof EvidenceCurationProposalSchema>;

export function createSearchEvidenceTool(deps: {
  evidenceKbService: EvidenceKbToolApi;
  ownerId: string;
  projectId: string;
}) {
  return createTool({
    id: 'search-evidence',
    description:
      'Search the evidence knowledge base for passages relevant to a query. Returns ranked passages with source info, scores, and locations. Use this to find factual evidence before curating or proposing graph changes.',
    inputSchema: v.object({
      query: described(v.string(), 'Natural language search query.'),
      mode: v.optional(
        described(
          v.union([v.literal('hybrid'), v.literal('bm25_only'), v.literal('vector_only')]),
          'Retrieval mode. Default: hybrid (best quality).'
        ),
        'hybrid'
      ),
      topK: v.optional(
        described(
          v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)),
          'Max results to return.'
        ),
        8
      ),
    }),
    outputSchema: v.object({
      retrievalRunId: v.string(),
      retrievalMode: v.string(),
      contexts: v.array(
        v.object({
          passageId: v.string(),
          sourceId: v.string(),
          text: v.string(),
          score: v.number(),
          finalRank: v.number(),
          bm25Rank: v.nullable(v.number()),
          vectorRank: v.nullable(v.number()),
          rrfScore: v.nullable(v.number()),
          location: v.object({
            page: v.nullable(v.number()),
            heading: v.nullable(v.string()),
          }),
        })
      ),
    }),
    execute: async ({ query, mode, topK }, context) => {
      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Searching evidence',
          detail: `Searching for: "${query}"`,
          status: 'started',
        },
        transient: true,
      });

      const result = await deps.evidenceKbService.retrieveForOwner({
        ownerId: deps.ownerId,
        projectId: deps.projectId,
        query,
        mode,
        topK,
      });

      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Evidence found',
          detail: `Found ${result.contexts.length} relevant passages.`,
          status: 'completed',
        },
        transient: true,
      });

      return {
        retrievalRunId: result.retrievalRunId,
        retrievalMode: result.retrievalMode,
        contexts: result.contexts.map((ctx) => ({
          passageId: ctx.passage_id,
          sourceId: ctx.source_id,
          text: ctx.text,
          score: ctx.score,
          finalRank: ctx.final_rank,
          bm25Rank: ctx.bm25_rank ?? null,
          vectorRank: ctx.vector_rank ?? null,
          rrfScore: ctx.rrf_score ?? null,
          location: {
            page: ctx.location.page ?? null,
            heading: ctx.location.heading ?? null,
          },
        })),
      };
    },
  });
}

export function createListEvidenceSourcesTool(deps: {
  evidenceKbService: EvidenceKbToolApi;
  ownerId: string;
  projectId: string;
}) {
  return createTool({
    id: 'list-evidence-sources',
    description:
      'List all evidence sources in the project knowledge base. Shows source titles, types, curation status, and quality warnings.',
    inputSchema: v.object({}),
    outputSchema: v.object({
      sources: v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          sourceType: v.string(),
          status: v.optional(v.string()),
          retrievalEnabled: v.optional(v.boolean()),
          qualityWarnings: v.optional(v.array(v.string())),
        })
      ),
    }),
    execute: async (_input, context) => {
      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Listing sources',
          detail: 'Fetching evidence sources from knowledge base.',
          status: 'started',
        },
        transient: true,
      });

      const sources = await deps.evidenceKbService.listSourcesForOwner({
        ownerId: deps.ownerId,
        projectId: deps.projectId,
      });

      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Sources listed',
          detail: `Found ${sources.length} sources.`,
          status: 'completed',
        },
        transient: true,
      });

      return {
        sources: sources.map((s) => ({
          id: s.id,
          title: s.title,
          sourceType: s.source_type,
          status: s.status,
          retrievalEnabled: s.retrieval_enabled,
          qualityWarnings: s.quality_warnings,
        })),
      };
    },
  });
}

export function createProposeEvidenceCurationTool(_deps: {
  evidenceKbService: EvidenceKbToolApi;
  ownerId: string;
  projectId: string;
}) {
  return createTool({
    id: 'propose-evidence-curation',
    description:
      'Propose curation actions on evidence passages (certify, reject, toggle retrieval, add/clear warnings). Actions are submitted for user approval before taking effect.',
    inputSchema: EvidenceCurationProposalSchema,
    execute: async (input, context) => {
      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Preparing curation',
          detail: 'Drafting evidence curation actions for your review.',
          status: 'started',
        },
        transient: true,
      });

      await context?.writer?.custom({
        type: 'data-agent-curation',
        data: input,
      });

      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Curation ready',
          detail: 'Curation proposal submitted for approval.',
          status: 'completed',
        },
        transient: true,
      });

      return { status: 'curation_submitted', proposal: input };
    },
  });
}

export function createFindWeakPassagesTool(deps: {
  evidenceKbService: EvidenceKbToolApi;
  ownerId: string;
  projectId: string;
}) {
  return createTool({
    id: 'find-weak-passages',
    description:
      'Find passages that need attention: low quality score, quality warnings, rejected status, or disabled retrieval. Use this to discover passages that should be reviewed or curated.',
    inputSchema: v.object({
      minQualityScore: v.optional(
        described(
          v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
          'Minimum quality score threshold. Passages below this are flagged. Default: 0.5.'
        ),
        0.5
      ),
      limit: v.optional(
        described(
          v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
          'Max results to return.'
        ),
        20
      ),
    }),
    outputSchema: v.object({
      passages: v.array(
        v.object({
          id: v.string(),
          text: v.string(),
          status: v.optional(v.string()),
          retrievalEnabled: v.optional(v.boolean()),
          qualityScore: v.number(),
          qualityWarnings: v.optional(v.array(v.string())),
          sourceId: v.string(),
        })
      ),
    }),
    execute: async ({ minQualityScore, limit }, context) => {
      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Finding weak passages',
          detail: `Searching for passages with quality < ${minQualityScore} or with warnings.`,
          status: 'started',
        },
        transient: true,
      });

      const passages = await deps.evidenceKbService.findWeakPassagesForOwner({
        ownerId: deps.ownerId,
        projectId: deps.projectId,
        minQualityScore,
        limit,
      });

      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Weak passages found',
          detail: `Found ${passages.length} passages needing attention.`,
          status: 'completed',
        },
        transient: true,
      });

      return {
        passages: passages.map((p) => ({
          id: p.id,
          text: p.text,
          status: p.status,
          retrievalEnabled: p.retrieval_enabled,
          qualityScore: p.quality_score,
          qualityWarnings: p.quality_warnings,
          sourceId: p.source_id,
        })),
      };
    },
  });
}

export function createFindStaleSourcesTool(deps: {
  evidenceKbService: EvidenceKbToolApi;
  ownerId: string;
  projectId: string;
}) {
  return createTool({
    id: 'find-stale-sources',
    description:
      'Find sources that need review: not yet certified, have quality warnings, or have retrieval disabled. Use this to discover sources that should be curated or cleaned up.',
    inputSchema: v.object({
      limit: v.optional(
        described(
          v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
          'Max results to return.'
        ),
        20
      ),
    }),
    outputSchema: v.object({
      sources: v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          sourceType: v.string(),
          status: v.optional(v.string()),
          retrievalEnabled: v.optional(v.boolean()),
          qualityWarnings: v.optional(v.array(v.string())),
        })
      ),
    }),
    execute: async ({ limit }, context) => {
      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Finding stale sources',
          detail: 'Searching for sources that need review.',
          status: 'started',
        },
        transient: true,
      });

      const sources = await deps.evidenceKbService.findStaleSourcesForOwner({
        ownerId: deps.ownerId,
        projectId: deps.projectId,
        limit,
      });

      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Stale sources found',
          detail: `Found ${sources.length} sources needing review.`,
          status: 'completed',
        },
        transient: true,
      });

      return {
        sources: sources.map((s) => ({
          id: s.id,
          title: s.title,
          sourceType: s.source_type,
          status: s.status,
          retrievalEnabled: s.retrieval_enabled,
          qualityWarnings: s.quality_warnings,
        })),
      };
    },
  });
}

export function createBulkCurationTool(deps: {
  evidenceKbService: EvidenceKbToolApi;
  ownerId: string;
  projectId: string;
}) {
  return createTool({
    id: 'bulk-curation',
    description:
      'Apply multiple curation actions in a single batch. More efficient than proposing individual actions when you need to certify, reject, or modify many passages at once.',
    inputSchema: v.object({
      rationale: described(v.string(), 'A short message explaining what you are curating and why.'),
      actions: v.array(CurationActionSchema),
    }),
    outputSchema: v.object({
      total: v.number(),
      succeeded: v.number(),
      failed: v.number(),
      results: v.array(
        v.object({
          ok: v.boolean(),
          action: v.unknown(),
          error: v.optional(v.string()),
        })
      ),
    }),
    execute: async ({ actions, rationale }, context) => {
      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Bulk curation',
          detail: `Applying ${actions.length} curation actions: ${rationale}`,
          status: 'started',
        },
        transient: true,
      });

      const result = await deps.evidenceKbService.bulkCurationForOwner({
        ownerId: deps.ownerId,
        projectId: deps.projectId,
        actions,
      });

      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Bulk curation complete',
          detail: `${result.succeeded}/${result.total} actions succeeded.`,
          status: 'completed',
        },
        transient: true,
      });

      return result;
    },
  });
}

export function createExportPassagesTool(deps: {
  evidenceKbService: EvidenceKbToolApi;
  ownerId: string;
  projectId: string;
}) {
  return createTool({
    id: 'export-passages',
    description:
      'Export passages from the knowledge base with optional filtering by source or status. Use this to review all passages, generate reports, or prepare data for external analysis.',
    inputSchema: v.object({
      sourceId: v.optional(described(v.string(), 'Filter by specific source ID.')),
      status: v.optional(
        described(
          v.union([
            v.literal('candidate'),
            v.literal('certified'),
            v.literal('deprecated'),
            v.literal('rejected'),
          ]),
          'Filter by passage status.'
        )
      ),
      format: v.optional(described(v.string(), 'Export format. Default: json.'), 'json'),
    }),
    outputSchema: v.object({
      total: v.number(),
      passages: v.array(
        v.object({
          id: v.string(),
          sourceId: v.string(),
          text: v.string(),
          status: v.optional(v.string()),
          qualityScore: v.number(),
          qualityWarnings: v.optional(v.array(v.string())),
          retrievalEnabled: v.optional(v.boolean()),
          tokenCount: v.number(),
        })
      ),
    }),
    execute: async ({ sourceId, status, format }, context) => {
      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Exporting passages',
          detail: sourceId
            ? `Exporting passages from source ${sourceId}`
            : status
              ? `Exporting ${status} passages`
              : 'Exporting all passages',
          status: 'started',
        },
        transient: true,
      });

      const result = await deps.evidenceKbService.exportPassagesForOwner({
        ownerId: deps.ownerId,
        projectId: deps.projectId,
        sourceId,
        status,
        format,
      });

      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Export complete',
          detail: `Exported ${result.total} passages.`,
          status: 'completed',
        },
        transient: true,
      });

      return {
        total: result.total,
        passages: result.passages.map((p) => ({
          id: p.id,
          sourceId: p.source_id,
          text: p.text,
          status: p.status,
          qualityScore: p.quality_score,
          qualityWarnings: p.quality_warnings,
          retrievalEnabled: p.retrieval_enabled,
          tokenCount: p.token_count,
        })),
      };
    },
  });
}

export function createGetSurroundingPassagesTool(deps: {
  evidenceKbService: EvidenceKbToolApi;
  ownerId: string;
  projectId: string;
}) {
  return createTool({
    id: 'get-surrounding-passages',
    description: 'Fetch the surrounding passages (before and after) for a specific passage ID to gain temporal or sequential context from the original source document.',
    inputSchema: v.object({
      passageId: described(v.string(), 'The target passage ID.'),
      before: v.optional(described(v.number(), 'Number of preceding passages to retrieve (max 10). Default is 1.'), 1),
      after: v.optional(described(v.number(), 'Number of succeeding passages to retrieve (max 10). Default is 1.'), 1),
    }),
    outputSchema: v.array(
      v.object({
        id: v.string(),
        sourceId: v.string(),
        text: v.string(),
        status: v.optional(v.string()),
        qualityScore: v.number(),
        qualityWarnings: v.optional(v.array(v.string())),
        retrievalEnabled: v.optional(v.boolean()),
      })
    ),
    execute: async ({ passageId, before, after }, context) => {
      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Expanding context',
          detail: `Fetching surrounding passages for ${passageId}`,
          status: 'started',
        },
        transient: true,
      });

      const passages = await deps.evidenceKbService.getSurroundingPassagesForOwner({
        ownerId: deps.ownerId,
        projectId: deps.projectId,
        passageId,
        before,
        after,
      });

      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Context fetched',
          detail: `Found ${passages.length} surrounding passages.`,
          status: 'completed',
        },
        transient: true,
      });

      return passages.map((p) => ({
        id: p.id,
        sourceId: p.source_id,
        text: p.text,
        status: p.status,
        qualityScore: p.quality_score,
        qualityWarnings: p.quality_warnings,
        retrievalEnabled: p.retrieval_enabled,
      }));
    },
  });
}

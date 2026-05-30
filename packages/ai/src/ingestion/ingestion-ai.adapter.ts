import { canUseAgent } from '../index';
import { canUseEmbeddingModel, embedText, embedTexts } from '../utils/embeddings';
import { createIngestionRetrievalTools } from './ingestion-retrieval-tools';
import { runIngestionChunkAgent } from './extract-chunk';
import { sourceLinkingWorkflow } from './source-linking-workflow';
import type {
  IngestionAiPort,
  ExtractChunkPortInput,
  EvaluateLinkCandidatesPortInput,
  EvaluateLinkCandidatesPortOutput,
  IngestionConcept,
  IngestionConceptContext,
  IngestionConceptSearchResult,
  LinkTrace,
} from '@grasp/domain';

/**
 * Narrow port for the ingestion AI adapter — only the retrieval methods it actually uses.
 * Callers can pass a full KnowledgebaseRepository (which satisfies this interface)
 * or a focused test double.
 */
export type IngestionRetrievalPort = {
  getConceptContext(input: { conceptKey: string; projectId: string }): Promise<IngestionConceptContext | null>;
  searchConceptsForIngestion(input: {
    embedding?: number[];
    limit?: number;
    projectId: string;
    query: string;
  }): Promise<IngestionConceptSearchResult[]>;
};

export class IngestionAiAdapter implements IngestionAiPort {
  constructor(private readonly retrievalPort: IngestionRetrievalPort) {}

  async extractConceptsFromChunk(input: ExtractChunkPortInput) {
    if (!canUseAgent()) {
      throw new Error(
        'No LLM provider configured for ingestionAgent. Set AI_MODEL and an appropriate API key before running ingestion.'
      );
    }

    const retrievalTools = createIngestionRetrievalTools({
      getConceptContext: (conceptKey) =>
        this.retrievalPort
          .getConceptContext({ conceptKey, projectId: input.projectId })
          .then((context: IngestionConceptContext | null) => {
            if (input.onRetrieval) {
              input.onRetrieval(context?.neighbors.length ?? 0, conceptKey, 'concept_neighbors');
            }
            return context;
          }),
      searchWikiConcepts: async (query, limit) => {
        const embedding = await this.embedQuery(query);
        const concepts = await this.retrievalPort.searchConceptsForIngestion({
          embedding,
          limit,
          projectId: input.projectId,
          query,
        });
        if (input.onRetrieval) {
          input.onRetrieval(concepts.length, query, 'concept_search');
        }
        return concepts;
      },
    });

    const retrievedConcepts = await this.retrieveExistingConceptContext({
      blocks: input.blocks.map((b) => b.text),
      projectId: input.projectId,
      onRetrieval: input.onRetrieval,
    });

    const mastraMemory = {
      resource: input.projectId,
      thread: `ingestion:${input.sourceId}:chunk:${input.chunkIndex}`,
    };

    const runResult = await runIngestionChunkAgent({
      blocks: input.blocks.map((block) => ({ id: block.id, text: block.text })),
      chunkIndex: input.chunkIndex,
      draftConcepts: input.draftConcepts,
      draftRelationships: input.draftRelationships,
      memory: mastraMemory,
      retrievedConcepts,
      retrievalTools,
      sourceId: input.sourceId,
      totalChunks: input.totalChunks,
      onThinking: input.onThinking,
    });

    return runResult.domain;
  }

  async evaluateLinkCandidates(
    input: EvaluateLinkCandidatesPortInput
  ): Promise<EvaluateLinkCandidatesPortOutput> {
    const linkingRun = await sourceLinkingWorkflow.createRun({
      resourceId: input.projectId,
    });
    
    const linkingResult = await linkingRun.start({
      inputData: {
        candidates: input.candidates,
        extraction: input.extraction,
        useModel: true,
      },
    });
    
    if (linkingResult.status !== 'success') {
      throw new Error(`linking_workflow_${linkingResult.status}`);
    }

    return {
      reviewedLinks: linkingResult.result?.reviewedLinks ?? [],
      policyResults: linkingResult.result?.policyResults ?? [],
      acceptedLinks: linkingResult.result?.acceptedLinks ?? [],
      rejectedLinks: linkingResult.result?.rejectedLinks ?? [],
      patchedExtraction: linkingResult.result?.patchedExtraction ?? input.extraction,
      trace: linkingResult.result?.trace as LinkTrace,
    };
  }

  async embedConcepts(concepts: IngestionConcept[]) {
    if (!canUseEmbeddingModel(process.env) || !concepts.length) {
      return {
        embeddingsByKey: undefined,
        metadata: { status: 'skipped', reason: 'embedding_provider_not_configured' },
      };
    }

    try {
      const embeddings = await embedTexts(concepts.map((c) => `${c.name}\n\n${c.definition}`));
      const embeddingsByKey: Record<string, number[]> = {};

      concepts.forEach((concept, index) => {
        const key = concept.mergesWith ?? concept.conceptKey;
        const embedding = embeddings[index];
        if (embedding) {
          embeddingsByKey[key] = embedding;
        }
      });

      return {
        embeddingsByKey,
        metadata: { status: 'completed', embeddedConceptCount: Object.keys(embeddingsByKey).length },
      };
    } catch (error) {
      return {
        embeddingsByKey: undefined,
        metadata: {
          reason: error instanceof Error ? error.message : 'concept_embedding_failed',
          status: 'failed',
        },
      };
    }
  }

  private async embedQuery(query: string) {
    if (!canUseEmbeddingModel(process.env)) {
      return undefined;
    }
    try {
      return await embedText(query);
    } catch {
      return undefined;
    }
  }

  private async retrieveExistingConceptContext(input: {
    blocks: string[];
    projectId: string;
    onRetrieval?: ExtractChunkPortInput['onRetrieval'];
  }): Promise<IngestionConceptContext[]> {
    const query = input.blocks.join('\n\n').slice(0, 1200).trim();
    if (!query) return [];

    const embedding = await this.embedQuery(query);
    const concepts = await this.retrievalPort.searchConceptsForIngestion({
      embedding,
      limit: 3,
      projectId: input.projectId,
      query,
    });

    if (input.onRetrieval) {
      input.onRetrieval(concepts.length, query, 'concept_search');
    }

    const rawContexts = await Promise.all(
      concepts.slice(0, 2).map(async (concept: { conceptKey: string; name: string; definition: string }) => {
        const context = await this.retrievalPort.getConceptContext({
          conceptKey: concept.conceptKey,
          projectId: input.projectId,
        });
        if (input.onRetrieval) {
          input.onRetrieval(context?.neighbors.length ?? 0, concept.conceptKey, 'concept_neighbors');
        }
        return context;
      })
    );

    return rawContexts.filter((c): c is IngestionConceptContext => c !== null);
  }
}

import 'server-only';
import { LazyGraphRagClient, type IndexSourceRequest } from '@grasp/lazy-graph-rag-client';
import type { ProjectRepository } from '@grasp/db';
import type { KnowledgebaseGraphReadModel } from '@grasp/domain';

export type LgsService = ReturnType<typeof createLgsService>;

export function createLgsService(input: {
  apiKey?: string;
  baseUrl?: string;
  projectRepository: ProjectRepository;
}) {
  if (!input.baseUrl) {
    return null;
  }

  const client = new LazyGraphRagClient({
    apiKey: input.apiKey,
    baseUrl: input.baseUrl,
  });

  const requireOwnedProject = async (projectId: string, ownerId: string) => {
    const project = await input.projectRepository.findByIdForOwner(projectId, ownerId);

    if (!project) {
      throw new Error('Unauthorized');
    }

    return project;
  };

  return {
    async indexSourceForOwner(request: {
      content: string;
      ownerId: string;
      projectId: string;
      sourceId: string;
      sourceTitle: string;
      sourceType: 'markdown' | 'text' | 'web';
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);

      const sourceType: IndexSourceRequest['sourceType'] =
        request.sourceType === 'markdown' ? 'markdown' : 'text';

      return client.indexSource({
        collectionId: request.projectId,
        content: request.content,
        documentName: request.sourceTitle,
        sourceId: request.sourceId,
        sourceType,
        tenantId: request.ownerId,
      });
    },

    async deleteSourceForOwner(request: {
      ownerId: string;
      projectId: string;
      sourceId: string;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);

      return client.deleteSource({
        collectionId: request.projectId,
        sourceId: request.sourceId,
        tenantId: request.ownerId,
      });
    },

    async deleteCollectionForOwner(request: {
      ownerId: string;
      projectId: string;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);

      return client.deleteCollection({
        collectionId: request.projectId,
        tenantId: request.ownerId,
      });
    },

    async getLocalGraphForOwner(request: {
      limit?: number;
      ownerId: string;
      projectId: string;
    }): Promise<KnowledgebaseGraphReadModel> {
      await requireOwnedProject(request.projectId, request.ownerId);

      const graph = await client.getLocalGraph({
        collectionId: request.projectId,
        limit: request.limit ?? 200,
        tenantId: request.ownerId,
      });

      return {
        concepts: graph.nodes.map((node) => ({
          confidence: '1',
          definition: node.data?.type
            ? `Extracted ${String(node.data.type).toLowerCase()} term from indexed source material.`
            : 'Extracted term from indexed source material.',
          difficulty: 'beginner',
          evidenceCount: Number(node.data?.frequency ?? 0),
          id: node.id,
          name: String(node.data?.label ?? node.id),
          sourceEvidence: [],
        })),
        relationships: graph.edges.map((edge) => ({
          evidenceCount: Number(edge.data?.weight ?? 0),
          id: edge.id,
          metadata: edge.data,
          relationshipType: 'co_occurs',
          sourceConceptId: edge.source,
          sourceEvidence: [],
          targetConceptId: edge.target,
        })),
        source: 'lgs',
      };
    },
  };
}

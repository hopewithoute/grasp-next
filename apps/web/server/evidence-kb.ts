import { ProjectRepository } from '@grasp/domain';
import {
  bulkCuration,
  deleteProject,
  deleteSource,
  deleteSourceWithProject,
  exportPassages,
  findStaleSources,
  findWeakPassages,
  getConceptGraph,
  getSource,
  getSourceViewerUrl,
  getSourceWithProject,
  getSurroundingPassages,
  ingestPdf,
  ingestSource,
  inspectPassage,
  listPassages,
  listRunsForProject,
  listSources,
  retrieve,
} from '@/api-client';
import type {
  ConceptGraphResponse,
  Location,
  PaginatedPassagesResponse,
  PassageRecord,
  RetrievedPassage,
  RetrieveResponse,
  SourceRecord,
} from '@/api-client';
import { client } from '@/api-client/client.gen';

export type EvidenceKbCurationAction = {
  passageId: string;
  type: string;
  approved_by?: string;
  rejection_reason?: string;
};
export type EvidenceKbSource = SourceRecord;
export type EvidenceKbPassage = PassageRecord;
export type EvidenceKbConceptGraphResponse = ConceptGraphResponse;
export type EvidenceKbRetrieveResponse = RetrieveResponse;
export type EvidenceKbRetrievedPassage = RetrievedPassage;
export type EvidenceKbLocation = Location;
export type { PaginatedPassagesResponse };

export function configureEvidenceKbClient(apiKey?: string, baseUrl?: string) {
  client.setConfig({
    baseUrl: baseUrl?.replace(/\/$/, '') || '',
    headers: apiKey ? { 'x-api-key': apiKey } : {},
  });
}

interface ExportedPassage {
  id: string;
  source_id: string;
  text: string;
  status?: string;
  quality_score: number;
  quality_warnings?: string[];
  retrieval_enabled?: boolean;
  token_count: number;
  location: Record<string, unknown>;
}

interface BulkCurationAction extends Record<string, unknown> {
  passage_id: string;
  status: string;
  approved_by?: string;
  rejection_reason?: string;
}

export function createEvidenceKbService(input: {
  apiKey?: string;
  baseUrl?: string;
  projectRepository: ProjectRepository;
}) {
  configureEvidenceKbClient(input.apiKey, input.baseUrl);

  const requireOwnedProject = async (projectId: string, ownerId: string) => {
    const project = await input.projectRepository.findByIdForOwner(projectId, ownerId);
    if (!project) throw new Error('Unauthorized');
    return project;
  };

  const unwrap = <T>(res: { data?: T; error?: unknown }): T => {
    if (res.error) throw new Error(JSON.stringify(res.error));
    if (!res.data) throw new Error('No data returned');
    return res.data;
  };

  const ACTION_STATUS_MAP: Record<string, string> = {
    certify_passage: 'certified',
    reject_passage: 'rejected',
  };

  const mapAction = (a: EvidenceKbCurationAction): BulkCurationAction => ({
    passage_id: a.passageId,
    status: ACTION_STATUS_MAP[a.type] || a.type,
    approved_by: a.approved_by,
    rejection_reason: a.rejection_reason,
  });

  return {
    async applyCurationForOwner(request: {
      actions: EvidenceKbCurationAction[];
      ownerId: string;
      projectId: string;
    }) {
      return this.bulkCurationForOwner(request);
    },
    async bulkCurationForOwner(request: {
      actions: EvidenceKbCurationAction[];
      ownerId: string;
      projectId: string;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);
      const res = unwrap(
        await bulkCuration({
          body: { actions: request.actions.map(mapAction) },
          query: { project_id: request.projectId, tenant_id: request.ownerId },
        })
      );
      return {
        ...res,
        results: res.results as Array<{ action: unknown; error?: string; ok: boolean }>,
      };
    },
    async exportPassagesForOwner(request: {
      format?: string;
      ownerId: string;
      projectId: string;
      sourceId?: string;
      status?: string;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);
      return unwrap(
        await exportPassages({
          body: { format: request.format, source_id: request.sourceId, status: request.status },
          query: { project_id: request.projectId, tenant_id: request.ownerId },
        })
      ) as { passages: ExportedPassage[]; total: number };
    },
    async ingestSourceForOwner(request: {
      content: string;
      ownerId: string;
      projectId: string;
      sourceId: string;
      sourceTitle: string;
      sourceType: 'markdown' | 'text' | 'web';
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);
      return unwrap(
        await ingestSource({
          body: {
            tenantId: request.ownerId,
            projectId: request.projectId,
            externalSourceId: request.sourceId,
            title: request.sourceTitle,
            sourceType: request.sourceType,
            text: request.content,
            metadata: { sourceTitle: request.sourceTitle },
          },
        })
      );
    },
    async inspectPassageForOwner(request: {
      ownerId: string;
      passageId: string;
      projectId: string;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);
      return unwrap(await inspectPassage({ path: { passage_id: request.passageId } }));
    },
    async ingestPdfForOwner(request: {
      externalSourceId: string;
      file: File | Blob;
      ownerId: string;
      projectId: string;
      title: string;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);
      return unwrap(
        await ingestPdf({
          body: {
            tenantId: request.ownerId,
            projectId: request.projectId,
            externalSourceId: request.externalSourceId,
            title: request.title,
            file: request.file,
          },
        })
      );
    },
    async getSurroundingPassagesForOwner(request: {
      ownerId: string;
      passageId: string;
      projectId: string;
      before?: number;
      after?: number;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);
      return unwrap(
        await getSurroundingPassages({
          path: { passage_id: request.passageId },
          query: { before: request.before, after: request.after },
        })
      );
    },
    async listPassagesForOwner(request: {
      ownerId: string;
      projectId: string;
      sourceId: string;
      limit?: number;
      offset?: number;
      query?: string;
      status?: string;
      retrievalEnabled?: boolean;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);
      return unwrap(
        await listPassages({
          path: { source_id: request.sourceId },
          query: {
            limit: request.limit,
            skip: request.offset,
            query: request.query,
            status: request.status,
            retrieval_enabled: request.retrievalEnabled,
          },
        })
      );
    },
    async listSourcesForOwner(request: { ownerId: string; projectId: string }) {
      await requireOwnedProject(request.projectId, request.ownerId);
      return unwrap(
        await listSources({
          path: { project_id: request.projectId },
          query: { tenantId: request.ownerId },
        })
      );
    },
    async getSourceForOwner(request: { ownerId: string; projectId: string; sourceId: string }) {
      await requireOwnedProject(request.projectId, request.ownerId);
      return unwrap(
        await getSourceWithProject({
          path: { project_id: request.projectId, external_source_id: request.sourceId },
          query: { tenantId: request.ownerId },
        })
      );
    },
    async getSourceBySourceIdForOwner(request: { ownerId: string; sourceId: string }) {
      return unwrap(
        await getSource({
          path: { external_source_id: request.sourceId },
          query: { tenantId: request.ownerId },
        })
      );
    },
    async getSourceViewerUrlForOwner(request: { ownerId: string; sourceId: string }) {
      return unwrap(
        await getSourceViewerUrl({
          path: { external_source_id: request.sourceId },
          query: { tenantId: request.ownerId },
        })
      ) as { url?: string; html?: string };
    },
    async deleteSourceForOwner(request: { ownerId: string; projectId: string; sourceId: string }) {
      await requireOwnedProject(request.projectId, request.ownerId);
      return unwrap(
        await deleteSourceWithProject({
          path: { project_id: request.projectId, external_source_id: request.sourceId },
          query: { tenantId: request.ownerId },
        })
      );
    },
    async listRunsForProjectOwner(request: { ownerId: string; projectId: string; limit?: number }) {
      await requireOwnedProject(request.projectId, request.ownerId);
      return unwrap(
        await listRunsForProject({
          path: { project_id: request.projectId },
          query: { limit: request.limit },
        })
      );
    },
    async deleteSourceBySourceIdForOwner(request: { ownerId: string; sourceId: string }) {
      return unwrap(
        await deleteSource({
          path: { external_source_id: request.sourceId },
          query: { tenantId: request.ownerId },
        })
      );
    },
    async deleteProjectForOwner(request: { ownerId: string; projectId: string }) {
      await requireOwnedProject(request.projectId, request.ownerId);
      return unwrap(
        await deleteProject({
          path: { project_id: request.projectId },
          query: { tenantId: request.ownerId },
        })
      );
    },
    async retrieveForOwner(request: {
      filters?: Record<string, unknown>;
      mode?: 'hybrid' | 'bm25_only' | 'vector_only';
      ownerId: string;
      projectId: string;
      query: string;
      topK?: number;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);
      return unwrap(
        await retrieve({
          body: {
            tenantId: request.ownerId,
            projectId: request.projectId,
            query: request.query,
            filters: request.filters,
            mode: request.mode,
            topK: request.topK,
          },
        })
      );
    },
    async findWeakPassagesForOwner(request: {
      limit?: number;
      minQualityScore?: number;
      ownerId: string;
      projectId: string;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);
      return unwrap(
        await findWeakPassages({
          query: {
            project_id: request.projectId,
            tenant_id: request.ownerId,
            min_quality_score: request.minQualityScore,
            limit: request.limit,
          },
        })
      );
    },
    async findStaleSourcesForOwner(request: {
      limit?: number;
      ownerId: string;
      projectId: string;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);
      return unwrap(
        await findStaleSources({
          path: { project_id: request.projectId },
          query: { tenant_id: request.ownerId, limit: request.limit },
        })
      );
    },
    async getConceptGraphForOwner(input: {
      ownerId: string;
      projectId: string;
      minWeight?: number;
    }) {
      return unwrap(
        await getConceptGraph({
          path: { project_id: input.projectId },
          query: { tenantId: input.ownerId, min_weight: input.minWeight },
        })
      );
    },
  };
}

export type EvidenceKbService = ReturnType<typeof createEvidenceKbService>;

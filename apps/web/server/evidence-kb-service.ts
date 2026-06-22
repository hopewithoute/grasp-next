import 'server-only';
import type { ProjectRepository } from '@grasp/db';

export type EvidenceKbService = ReturnType<typeof createEvidenceKbService>;

export type EvidenceKbCurationStatus = 'candidate' | 'certified' | 'deprecated' | 'rejected';

export type EvidenceKbViewerUrlResponse = {
  url?: string;
  html?: string;
};

export type EvidenceKbIngestSourceResponse = {
  ingestionRunId: string;
  passageCount: number;
  sourceId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  warningCount: number;
};

export type EvidenceKbSource = {
  external_source_id: string;
  id: string;
  metadata?: Record<string, unknown>;
  metadata_?: Record<string, unknown>;
  project_id: string;
  quality_warnings: string[];
  retrieval_enabled: boolean;
  source_type: 'text' | 'markdown' | 'html' | 'pdf' | 'web';
  status: EvidenceKbCurationStatus;
  tenant_id: string;
  title: string;
};

export type EvidenceKbPassage = {
  block_id: string;
  id: string;
  kind: string;
  location: {
    end_offset?: number | null;
    heading?: string | null;
    page?: number | null;
    start_offset?: number | null;
  };
  order: number;
  project_id: string;
  quality_score: number;
  quality_warnings: string[];
  retrieval_enabled: boolean;
  source_id: string;
  status: EvidenceKbCurationStatus;
  tenant_id: string;
  text: string;
  token_count: number;
};

export type PaginatedPassagesResponse = {
  items: EvidenceKbPassage[];
  total: number;
};

export type EvidenceKbRetrievedPassage = {
  bm25_rank?: number | null;
  final_rank: number;
  location: EvidenceKbPassage['location'];
  passage_id: string;
  rrf_score?: number | null;
  score: number;
  source_id: string;
  status: 'candidate' | 'certified' | 'deprecated' | 'rejected';
  quality_score: number;
  token_count: number;
  retrieval_enabled: boolean;
  text: string;
  vector_rank?: number | null;
};

export type EvidenceKbRetrieveResponse = {
  contexts: EvidenceKbRetrievedPassage[];
  debug: Record<string, unknown>;
  query: string;
  retrievalMode: 'hybrid' | 'bm25_only' | 'vector_only';
  retrievalRunId: string;
};

export type EvidenceKbCurationAction =
  | { sourceId: string; type: 'certify_source' | 'deprecate_source' | 'reject_source' | 'reset_source' }
  | { enabled: boolean; sourceId: string; type: 'set_source_retrieval_enabled' }
  | { passageId: string; type: 'certify_passage' | 'reject_passage' | 'reset_passage' }
  | { enabled: boolean; passageId: string; type: 'set_passage_retrieval_enabled' }
  | { passageId: string; type: 'clear_quality_warning'; warning?: string }
  | { passageId: string; type: 'add_quality_warning'; warning: string };

export type EvidenceKbApplyCurationResponse = {
  results: Array<{ action: unknown; error?: string; ok: boolean }>;
};

class EvidenceKbClient {
  constructor(private options: { apiKey?: string; baseUrl: string }) {}

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.options.baseUrl.replace(/\/$/, '')}${path}`;
    const headers = new Headers(options.headers);
    if (!(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (this.options.apiKey) {
      headers.set('x-api-key', this.options.apiKey);
    }

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      throw new Error(`Evidence KB request failed: ${response.status} ${await response.text()}`);
    }
    return response.json() as Promise<T>;
  }

  private async get<T>(path: string): Promise<T> {
    return this.fetch<T>(path, { method: 'GET' });
  }

  private async delete<T>(path: string): Promise<T> {
    return this.fetch<T>(path, { method: 'DELETE' });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.fetch<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  private async postFormData<T>(path: string, body: FormData): Promise<T> {
    return this.fetch<T>(path, {
      method: 'POST',
      body,
    });
  }

  async ingestSource(request: {
    externalSourceId: string;
    metadata?: Record<string, unknown>;
    metadata_?: Record<string, unknown>;
    projectId: string;
    sourceType: 'markdown' | 'text' | 'web';
    tenantId: string;
    text: string;
    title: string;
  }) {
    return this.post<EvidenceKbIngestSourceResponse>('/v1/ingest/source', request);
  }

  async ingestPdf(request: {
    externalSourceId: string;
    file: File | Blob;
    projectId: string;
    tenantId: string;
    title: string;
  }) {
    const formData = new FormData();
    formData.append('tenantId', request.tenantId);
    formData.append('projectId', request.projectId);
    formData.append('externalSourceId', request.externalSourceId);
    formData.append('title', request.title);
    formData.append('file', request.file, 'document.pdf');
    
    return this.postFormData<EvidenceKbIngestSourceResponse>('/v1/ingest/pdf', formData);
  }

  async listSources(request: { projectId: string; tenantId: string }) {
    const params = new URLSearchParams({ tenantId: request.tenantId });
    return this.get<EvidenceKbSource[]>(`/v1/projects/${request.projectId}/sources?${params}`);
  }

  async getSource(request: { projectId: string; sourceId: string; tenantId: string }) {
    const params = new URLSearchParams({ tenantId: request.tenantId });
    return this.get<EvidenceKbSource>(
      `/v1/projects/${request.projectId}/sources/${request.sourceId}?${params}`
    );
  }

  async getSourceBySourceId(request: { sourceId: string; tenantId: string }) {
    const params = new URLSearchParams({ tenantId: request.tenantId });
    return this.get<EvidenceKbSource>(`/v1/sources/${request.sourceId}?${params}`);
  }

  async getSourceViewerUrl(request: { sourceId: string; tenantId: string }) {
    const params = new URLSearchParams({ tenantId: request.tenantId });
    return this.get<EvidenceKbViewerUrlResponse>(`/v1/sources/${request.sourceId}/viewer-url?${params}`);
  }

  async deleteSource(request: { projectId: string; sourceId: string; tenantId: string }) {
    const params = new URLSearchParams({ tenantId: request.tenantId });
    return this.delete<{ ok: boolean; deleted: boolean }>(
      `/v1/projects/${request.projectId}/sources/${request.sourceId}?${params}`
    );
  }

  async deleteSourceBySourceId(request: { sourceId: string; tenantId: string }) {
    const params = new URLSearchParams({ tenantId: request.tenantId });
    return this.delete<{ ok: boolean; deleted: boolean }>(`/v1/sources/${request.sourceId}?${params}`);
  }

  async deleteProject(request: { projectId: string; tenantId: string }) {
    const params = new URLSearchParams({ tenantId: request.tenantId });
    return this.delete<{ ok: boolean; deleted: boolean }>(
      `/v1/projects/${request.projectId}?${params}`
    );
  }

  async listPassages(request: { 
    limit?: number; 
    query?: string; 
    retrieval_enabled?: boolean; 
    skip?: number; 
    sort_direction?: string; 
    sort_field?: string; 
    sourceId: string;
    status?: string; 
  }) {
    const params = new URLSearchParams();
    Object.entries(request).forEach(([key, value]) => {
      if (key !== 'sourceId' && value !== undefined && value !== '') {
        params.set(key, String(value));
      }
    });
    
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return this.get<PaginatedPassagesResponse>(`/v1/sources/${request.sourceId}/passages${queryStr}`);
  }

  async inspectPassage(request: { passageId: string }) {
    return this.get<EvidenceKbPassage>(`/v1/passages/${request.passageId}`);
  }

  async getSurroundingPassages(request: { passageId: string; before?: number; after?: number }) {
    const params = new URLSearchParams();
    if (request.before !== undefined) params.set('before', request.before.toString());
    if (request.after !== undefined) params.set('after', request.after.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.get<EvidenceKbPassage[]>(`/v1/passages/${request.passageId}/surrounding${query}`);
  }

  async retrieve(request: {
    filters?: Record<string, unknown>;
    mode?: 'hybrid' | 'bm25_only' | 'vector_only';
    projectId: string;
    query: string;
    tenantId: string;
    topK?: number;
  }) {
    return this.post<EvidenceKbRetrieveResponse>('/v1/retrieve', {
      filters: request.filters ?? {},
      mode: request.mode ?? 'hybrid',
      projectId: request.projectId,
      query: request.query,
      tenantId: request.tenantId,
      topK: request.topK,
    });
  }

  async applyCuration(request: { actions: EvidenceKbCurationAction[], projectId: string, tenantId: string }) {
    const params = new URLSearchParams({
      project_id: request.projectId,
      tenant_id: request.tenantId,
    });
    return this.post<EvidenceKbApplyCurationResponse>(`/v1/curation/bulk?${params}`, { actions: request.actions });
  }

  async bulkCuration(request: {
    actions: EvidenceKbCurationAction[];
    projectId: string;
    tenantId: string;
  }) {
    const params = new URLSearchParams({
      project_id: request.projectId,
      tenant_id: request.tenantId,
    });
    return this.post<{
      failed: number;
      results: Array<{ action: unknown; error?: string; ok: boolean }>;
      succeeded: number;
      total: number;
    }>(`/v1/curation/bulk?${params}`, { actions: request.actions });
  }

  async exportPassages(request: {
    format?: string;
    projectId: string;
    sourceId?: string;
    status?: string;
    tenantId: string;
  }) {
    const params = new URLSearchParams({
      project_id: request.projectId,
      tenant_id: request.tenantId,
    });
    return this.post<{
      passages: Array<{
        id: string;
        location: Record<string, unknown>;
        quality_score: number;
        quality_warnings: string[];
        retrieval_enabled: boolean;
        source_id: string;
        status: string;
        text: string;
        token_count: number;
      }>;
      total: number;
    }>(`/v1/curation/export?${params}`, {
      source_id: request.sourceId,
      status: request.status,
      format: request.format ?? 'json',
    });
  }

  async findWeakPassages(request: {
    minQualityScore?: number;
    limit?: number;
    projectId: string;
    tenantId: string;
  }) {
    const params = new URLSearchParams({
      project_id: request.projectId,
      tenant_id: request.tenantId,
      min_quality_score: String(request.minQualityScore ?? 0.5),
      limit: String(request.limit ?? 50),
    });
    return this.get<EvidenceKbPassage[]>(`/v1/passages/weak?${params}`);
  }

  async findStaleSources(request: { limit?: number; projectId: string; tenantId: string }) {
    const params = new URLSearchParams({
      tenant_id: request.tenantId,
      limit: String(request.limit ?? 50),
    });
    return this.get<EvidenceKbSource[]>(
      `/v1/projects/${request.projectId}/sources/stale?${params}`
    );
  }
}

export function createEvidenceKbService(input: {
  apiKey?: string;
  baseUrl?: string;
  projectRepository: ProjectRepository;
}) {
  if (!input.baseUrl) {
    return null;
  }

  const client = new EvidenceKbClient({
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
    async applyCurationForOwner(request: {
      actions: EvidenceKbCurationAction[];
      ownerId: string;
      projectId: string;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);

      return client.applyCuration({ 
        actions: request.actions, 
        projectId: request.projectId, 
        tenantId: request.ownerId 
      });
    },

    async bulkCurationForOwner(request: {
      actions: EvidenceKbCurationAction[];
      ownerId: string;
      projectId: string;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);

      return client.bulkCuration({
        actions: request.actions,
        projectId: request.projectId,
        tenantId: request.ownerId,
      });
    },

    async exportPassagesForOwner(request: {
      format?: string;
      ownerId: string;
      projectId: string;
      sourceId?: string;
      status?: string;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);

      return client.exportPassages({
        format: request.format,
        projectId: request.projectId,
        sourceId: request.sourceId,
        status: request.status,
        tenantId: request.ownerId,
      });
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

      return client.ingestSource({
        externalSourceId: request.sourceId,
        metadata: {
          sourceTitle: request.sourceTitle,
        },
        projectId: request.projectId,
        sourceType: request.sourceType,
        tenantId: request.ownerId,
        text: request.content,
        title: request.sourceTitle,
      });
    },

    async inspectPassageForOwner(request: {
      ownerId: string;
      passageId: string;
      projectId: string;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);

      return client.inspectPassage({ passageId: request.passageId });
    },

    async ingestPdfForOwner(request: {
      externalSourceId: string;
      file: File | Blob;
      ownerId: string;
      projectId: string;
      title: string;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);

      return client.ingestPdf({
        externalSourceId: request.externalSourceId,
        file: request.file,
        projectId: request.projectId,
        tenantId: request.ownerId,
        title: request.title,
      });
    },

    async getSurroundingPassagesForOwner(request: {
      ownerId: string;
      passageId: string;
      projectId: string;
      before?: number;
      after?: number;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);

      return client.getSurroundingPassages({
        passageId: request.passageId,
        before: request.before,
        after: request.after,
      });
    },

    async listPassagesForOwner(request: { 
      limit?: number;
      ownerId: string; 
      projectId: string; 
      query?: string;
      retrieval_enabled?: boolean;
      skip?: number;
      sort_direction?: string;
      sort_field?: string;
      sourceId: string; 
      status?: string;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);

      return client.listPassages({ 
        limit: request.limit,
        query: request.query,
        retrieval_enabled: request.retrieval_enabled,
        skip: request.skip,
        sort_direction: request.sort_direction,
        sort_field: request.sort_field,
        sourceId: request.sourceId,
        status: request.status,
      });
    },

    async listSourcesForOwner(request: { ownerId: string; projectId: string }) {
      await requireOwnedProject(request.projectId, request.ownerId);

      return client.listSources({
        projectId: request.projectId,
        tenantId: request.ownerId,
      });
    },

    async getSourceForOwner(request: { ownerId: string; projectId: string; sourceId: string }) {
      await requireOwnedProject(request.projectId, request.ownerId);

      return client.getSource({
        projectId: request.projectId,
        sourceId: request.sourceId,
        tenantId: request.ownerId,
      });
    },

    async getSourceBySourceIdForOwner(request: { ownerId: string; sourceId: string }) {
      return client.getSourceBySourceId({
        sourceId: request.sourceId,
        tenantId: request.ownerId,
      });
    },

    async getSourceViewerUrlForOwner(request: { ownerId: string; sourceId: string }) {
      return client.getSourceViewerUrl({
        sourceId: request.sourceId,
        tenantId: request.ownerId,
      });
    },

    async deleteSourceForOwner(request: { ownerId: string; projectId: string; sourceId: string }) {
      await requireOwnedProject(request.projectId, request.ownerId);

      return client.deleteSource({
        projectId: request.projectId,
        sourceId: request.sourceId,
        tenantId: request.ownerId,
      });
    },

    async deleteSourceBySourceIdForOwner(request: { ownerId: string; sourceId: string }) {
      return client.deleteSourceBySourceId({
        sourceId: request.sourceId,
        tenantId: request.ownerId,
      });
    },

    async deleteProjectForOwner(request: { ownerId: string; projectId: string }) {
      await requireOwnedProject(request.projectId, request.ownerId);

      return client.deleteProject({
        projectId: request.projectId,
        tenantId: request.ownerId,
      });
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

      return client.retrieve({
        filters: request.filters,
        mode: request.mode,
        projectId: request.projectId,
        query: request.query,
        tenantId: request.ownerId,
        topK: request.topK,
      });
    },

    async findWeakPassagesForOwner(request: {
      limit?: number;
      minQualityScore?: number;
      ownerId: string;
      projectId: string;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);

      return client.findWeakPassages({
        limit: request.limit,
        minQualityScore: request.minQualityScore,
        projectId: request.projectId,
        tenantId: request.ownerId,
      });
    },

    async findStaleSourcesForOwner(request: {
      limit?: number;
      ownerId: string;
      projectId: string;
    }) {
      await requireOwnedProject(request.projectId, request.ownerId);

      return client.findStaleSources({
        limit: request.limit,
        projectId: request.projectId,
        tenantId: request.ownerId,
      });
    },
  };
}

export interface LgsClientOptions {
  baseUrl: string;
  apiKey?: string;
}

export interface IndexSourceRequest {
  tenantId?: string;
  collectionId: string;
  sourceId: string;
  sourceType: "text" | "markdown";
  documentName: string;
  content: string;
  contentUri?: string;
  contentMetadata?: Record<string, any>;
}

export interface IndexSourceResponse {
  status: "indexed" | "unchanged";
  documentId?: string;
  chunkCount: number;
  termCount: number;
  chunkTermCount: number;
  contentHash: string;
}

export interface DeleteSourceRequest {
  tenantId?: string;
  collectionId: string;
  sourceId: string;
}

export interface DeleteSourceResponse {
  status: "deleted";
  deletedDocumentCount: number;
}

export interface DeleteCollectionRequest {
  tenantId?: string;
  collectionId: string;
}

export interface DeleteCollectionResponse {
  status: "deleted";
  deletedDocumentCount: number;
}

export interface SearchRequest {
  tenantId?: string;
  collectionId: string;
  query: string;
  topK?: number;
}

export interface SearchResponse {
  results: Array<{
    chunk_id: string;
    document_id: string;
    source_id: string;
    document_name: string;
    content: string;
    start_offset: number;
    end_offset: number;
    score: number;
    lexical_rank?: number | null;
    vector_rank?: number | null;
  }>;
  trace: {
    lexical_count: number;
    vector_count: number;
    rrf_pool_size: number;
    lexical_chunk_ids?: string[];
    vector_chunk_ids?: string[];
  };
}

export interface LocalGraphRequest {
  tenantId?: string;
  collectionId: string;
  limit?: number;
}

export interface LocalGraphResponse {
  nodes: Array<{
    id: string;
    data: any;
    position: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    data: any;
  }>;
}

export interface GetChunksRequest {
  chunkIds: string[];
  tenantId?: string;
}

export interface GetChunksResponse {
  chunks: Array<{
    chunk_id: string;
    document_id: string;
    document_name: string;
    source_type: string;
    content: string;
    start_offset: number;
    end_offset: number;
    chunk_index: number;
  }>;
}

export class LazyGraphRagClient {
  constructor(private options: LgsClientOptions) {}

  private async fetch<T>(path: string, options: RequestInit): Promise<T> {
    const url = `${this.options.baseUrl.replace(/\/$/, '')}${path}`;
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (this.options.apiKey) {
      headers.set('Authorization', `Bearer ${this.options.apiKey}`);
    }

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      throw new Error(`LGS request failed: ${response.status} ${await response.text()}`);
    }
    return response.json();
  }

  private async post<T>(path: string, body: any): Promise<T> {
    return this.fetch<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async indexSource(req: IndexSourceRequest): Promise<IndexSourceResponse> {
    return this.post<IndexSourceResponse>('/v1/sources/index', req);
  }

  async deleteSource(req: DeleteSourceRequest): Promise<DeleteSourceResponse> {
    return this.post<DeleteSourceResponse>('/v1/sources/delete', req);
  }

  async deleteCollection(req: DeleteCollectionRequest): Promise<DeleteCollectionResponse> {
    return this.post<DeleteCollectionResponse>('/v1/collections/delete', req);
  }

  async search(req: SearchRequest): Promise<SearchResponse> {
    return this.post<SearchResponse>('/v1/search', req);
  }

  async getLocalGraph(req: LocalGraphRequest): Promise<LocalGraphResponse> {
    return this.post<LocalGraphResponse>('/v1/graph/local', req);
  }

  async getChunks(req: GetChunksRequest): Promise<GetChunksResponse> {
    return this.post<GetChunksResponse>('/v1/chunks/get', req);
  }
}

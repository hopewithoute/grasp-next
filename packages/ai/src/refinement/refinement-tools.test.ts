/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { createRefinementTools } from './refinement-tools';
import type { EvidenceKbToolApi } from './evidence-tools';

const mockEvidenceKb: EvidenceKbToolApi = {
  retrieveForOwner: async () => ({
    contexts: [
      {
        passage_id: 'p-1',
        source_id: 's-1',
        text: 'React was created by Facebook.',
        score: 0.95,
        final_rank: 1,
        bm25_rank: 1,
        vector_rank: 1,
        rrf_score: 0.95,
        location: { page: 1, heading: 'Introduction' },
      },
    ],
    retrievalMode: 'hybrid',
    retrievalRunId: 'run-1',
  }),
  listSourcesForOwner: async () => [
    {
      id: 's-1',
      title: 'React Docs',
      source_type: 'pdf',
      status: 'active',
      retrieval_enabled: true,
      quality_warnings: [],
    },
  ],
  inspectPassageForOwner: async () => ({
    id: 'p-1',
    text: 'React was created by Facebook.',
    status: 'active',
    retrieval_enabled: true,
    quality_score: 0.9,
    quality_warnings: [],
    source_id: 's-1',
    location: { page: 1, heading: 'Introduction' },
  }),
  applyCurationForOwner: async () => ({ results: [{ ok: true, action: {} }] }),
  findWeakPassagesForOwner: async () => [
    {
      id: 'p-2',
      text: 'A low quality passage.',
      status: 'candidate',
      retrieval_enabled: false,
      quality_score: 0.2,
      quality_warnings: ['low_confidence'],
      source_id: 's-1',
      location: { page: 3, heading: null },
    },
  ],
  findStaleSourcesForOwner: async () => [
    {
      id: 's-2',
      title: 'Outdated Source',
      source_type: 'web',
      status: 'candidate',
      retrieval_enabled: true,
      quality_warnings: [],
    },
  ],
  bulkCurationForOwner: async () => ({ results: [], total: 0, succeeded: 0, failed: 0 }),
  exportPassagesForOwner: async () => ({ passages: [], total: 0 }),
};

describe('refinement tools contract', () => {
  it('exposes web tools', () => {
    const tools = createRefinementTools({
      projectId: 'project-1',
      ownerId: 'owner-1',
    });

    expect(tools['search-web-ddg']).toBeTruthy();
    expect(tools['propose-web-source']).toBeTruthy();
  });
});

describe('evidence-kb tools', () => {
  it('does not register evidence tools when evidenceKbService is not provided', () => {
    const tools = createRefinementTools({
      projectId: 'project-1',
      ownerId: 'owner-1',
    });

    expect('search-evidence' in tools).toBe(false);
    expect('list-evidence-sources' in tools).toBe(false);
    expect('propose-evidence-curation' in tools).toBe(false);
    expect('find-weak-passages' in tools).toBe(false);
    expect('find-stale-sources' in tools).toBe(false);

    // Core tools still present
    expect(tools['search-web-ddg']).toBeTruthy();
  });

  it('registers evidence tools when evidenceKbService is provided', () => {
    const tools = createRefinementTools({
      projectId: 'project-1',
      ownerId: 'owner-1',
      evidenceKbService: mockEvidenceKb,
    });

    expect((tools as any)['search-evidence']).toBeTruthy();
    expect((tools as any)['list-evidence-sources']).toBeTruthy();
    expect((tools as any)['propose-evidence-curation']).toBeTruthy();

    // Core tools still present
    expect(tools['search-web-ddg']).toBeTruthy();
  });

  it('search-evidence delegates to evidenceKbService.retrieveForOwner', async () => {
    const tools = createRefinementTools({
      projectId: 'project-1',
      ownerId: 'owner-1',
      evidenceKbService: mockEvidenceKb,
    });

    const result = await ((tools as any)['search-evidence'] as any).execute(
      { query: 'React origins' },
      {} as any
    );

    expect(result.contexts).toHaveLength(1);
    expect(result.contexts[0].passageId).toBe('p-1');
    expect(result.contexts[0].text).toBe('React was created by Facebook.');
    expect(result.retrievalRunId).toBe('run-1');
  });

  it('list-evidence-sources delegates to evidenceKbService.listSourcesForOwner', async () => {
    const tools = createRefinementTools({
      projectId: 'project-1',
      ownerId: 'owner-1',
      evidenceKbService: mockEvidenceKb,
    });

    const result = await ((tools as any)['list-evidence-sources'] as any).execute({}, {} as any);

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].title).toBe('React Docs');
    expect(result.sources[0].sourceType).toBe('pdf');
  });

  it('propose-evidence-curation emits curation proposal without executing', async () => {
    const written: unknown[] = [];
    const tools = createRefinementTools({
      projectId: 'project-1',
      ownerId: 'owner-1',
      evidenceKbService: mockEvidenceKb,
    });

    const proposal = {
      rationale: 'Certify this passage.',
      actions: [{ type: 'certify_passage' as const, passageId: 'p-1' }],
    };

    const result = await ((tools as any)['propose-evidence-curation'] as any).execute(proposal, {
      writer: {
        custom: async (chunk: unknown) => written.push(chunk),
      },
    });

    expect(result.status).toBe('curation_submitted');
    expect(result.proposal).toEqual(proposal);

    const curationEvent = written.find(
      (c: any) => c.type === 'data-agent-curation'
    );
    expect(curationEvent).toBeTruthy();
    expect((curationEvent as any).data).toEqual(proposal);
  });

  it('find-weak-passages delegates to evidenceKbService.findWeakPassagesForOwner', async () => {
    const tools = createRefinementTools({
      projectId: 'project-1',
      ownerId: 'owner-1',
      evidenceKbService: mockEvidenceKb,
    });

    const result = await ((tools as any)['find-weak-passages'] as any).execute(
      { minQualityScore: 0.5, limit: 20 },
      {} as any
    );

    expect(result.passages).toHaveLength(1);
    expect(result.passages[0].id).toBe('p-2');
    expect(result.passages[0].qualityScore).toBe(0.2);
    expect(result.passages[0].qualityWarnings).toContain('low_confidence');
    expect(result.passages[0].retrievalEnabled).toBe(false);
  });

  it('find-stale-sources delegates to evidenceKbService.findStaleSourcesForOwner', async () => {
    const tools = createRefinementTools({
      projectId: 'project-1',
      ownerId: 'owner-1',
      evidenceKbService: mockEvidenceKb,
    });

    const result = await ((tools as any)['find-stale-sources'] as any).execute(
      { limit: 20 },
      {} as any
    );

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].id).toBe('s-2');
    expect(result.sources[0].title).toBe('Outdated Source');
    expect(result.sources[0].status).toBe('candidate');
  });
});

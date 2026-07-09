'use server';

import { revalidatePath } from 'next/cache';
// Removed unused redirect import
import {
  addProjectSource,
  addProjectSourceDto,
  addProjectSourceFromUrl,
  addProjectSourceFromUrlDto,
  canCreateProject,
  createProject,
  createProjectDto,
  deleteProject,
  deleteProjectDto,
  deleteProjectSource,
  deleteProjectSourceDto,
  PROJECT_STATUS,
  safeParse,
  updateProjectDetails,
  updateProjectDetailsDto,
  updateProjectSource,
  updateProjectSourceDto,
} from '@grasp/domain';
import { getActor as auth } from '@/server/actor';
import type {
  EvidenceKbCurationAction,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  EvidenceKbPassage,
  EvidenceKbRetrieveResponse,
  EvidenceKbSource,
  PaginatedPassagesResponse,
} from '@/server/evidence-kb';
import { createProjectDeps } from '@/server/project-deps';

// --- Form state types ---

export type CreateProjectFormState = {
  error: string | null;
  success?: boolean;
};

export type ProjectSourceFormState = {
  error: string | null;
  sourceId?: string;
  content?: string;
  success: boolean;
};

export type UpdateProjectDetailsFormState = {
  error: string | null;
  success: boolean;
};

export type DeleteProjectFormState = {
  error: string | null;
  success?: boolean;
};

// --- Project form actions ---

export async function createProjectFormAction(
  _state: CreateProjectFormState,
  formData: FormData
): Promise<CreateProjectFormState> {
  const actor = await auth();

  if (!canCreateProject(actor)) {
    return { error: 'Unauthorized.', success: false };
  }

  const parsed = safeParse(createProjectDto, {
    description: formData.get('description')?.toString().trim() || undefined,
    title: formData.get('title')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Please check the project fields.', success: false };
  }

  await createProject(parsed.output, createProjectDeps(), actor.id);

  revalidatePath('/dashboard/projects');

  return { error: null, success: true };
}

export async function deleteProjectFormAction(
  _state: DeleteProjectFormState,
  formData: FormData
): Promise<DeleteProjectFormState> {
  const actor = await auth();

  if (!actor) {
    return { error: 'Unauthorized.' };
  }

  const parsed = safeParse(deleteProjectDto, {
    projectId: formData.get('projectId')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Project ID is required.' };
  }

  try {
    const deps = createProjectDeps();
    const project = await deps.projectRepository.findByIdForOwner(
      parsed.output.projectId,
      actor.id
    );

    if (!project) {
      return { error: 'Unauthorized.' };
    }

    if (project.status === PROJECT_STATUS.PROCESSING) {
      return { error: 'Project cannot be deleted while processing.' };
    }

    await deleteProject(parsed.output, deps, actor);

    if (deps.evidenceKbService) {
      try {
        await deps.evidenceKbService.deleteProjectForOwner({
          ownerId: actor.id,
          projectId: project.id,
        });
      } catch (err) {
        console.error('Failed to delete project from Evidence KB:', err);
      }
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Project deletion failed.',
      success: false,
    };
  }

  return { error: null, success: true };
}

export async function updateProjectDetailsFormAction(
  _state: UpdateProjectDetailsFormState,
  formData: FormData
): Promise<UpdateProjectDetailsFormState> {
  const actor = await auth();

  if (!actor) {
    return { error: 'Unauthorized.', success: false };
  }

  const parsed = safeParse(updateProjectDetailsDto, {
    description: formData.get('description')?.toString().trim() || undefined,
    projectId: formData.get('projectId')?.toString() ?? '',
    title: formData.get('title')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Please check the project fields.', success: false };
  }

  try {
    await updateProjectDetails(parsed.output, createProjectDeps(), actor);

    revalidatePath(`/dashboard/projects/${parsed.output.projectId}`);

    return { error: null, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Project update failed.',
      success: false,
    };
  }
}

// --- Source form actions ---

export async function addProjectSourceFormAction(
  _state: ProjectSourceFormState,
  formData: FormData
): Promise<ProjectSourceFormState> {
  const actor = await auth();

  if (!actor) {
    return { error: 'Unauthorized.', success: false };
  }

  const parsed = safeParse(addProjectSourceDto, {
    content: formData.get('content')?.toString() ?? '',
    projectId: formData.get('projectId')?.toString() ?? '',
    title: formData.get('title')?.toString() ?? '',
    type: formData.get('type')?.toString() || 'markdown',
  });

  if (!parsed.success) {
    return { error: 'Source title and content are required.', success: false };
  }

  try {
    const deps = createProjectDeps();
    const source = await addProjectSource(parsed.output, deps, actor);

    revalidatePath('/dashboard/projects');
    revalidatePath(`/dashboard/projects/${source.projectId}`);

    return { error: null, sourceId: source.id, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Source creation failed.',
      success: false,
    };
  }
}

export async function addProjectSourceFromUrlFormAction(
  _state: ProjectSourceFormState,
  formData: FormData
): Promise<ProjectSourceFormState> {
  const actor = await auth();

  if (!actor) {
    return { error: 'Unauthorized.', success: false };
  }

  const parsed = safeParse(addProjectSourceFromUrlDto, {
    url: formData.get('url')?.toString() ?? '',
    projectId: formData.get('projectId')?.toString() ?? '',
    title: formData.get('title')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Source title and valid URL are required.', success: false };
  }

  try {
    const deps = createProjectDeps();

    const { extractWebpageContent } = await import('@grasp/ai');
    const text = await extractWebpageContent(parsed.output.url);

    const source = await addProjectSourceFromUrl(
      {
        projectId: parsed.output.projectId,
        title: parsed.output.title,
        url: parsed.output.url,
        content: text,
      },
      deps,
      actor
    );

    revalidatePath('/dashboard/projects');
    revalidatePath(`/dashboard/projects/${source.projectId}`);

    return { error: null, sourceId: source.id, content: text, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Source creation failed.',
      success: false,
    };
  }
}

export async function addProjectSourceFromPdfFormAction(
  _state: ProjectSourceFormState,
  formData: FormData
): Promise<ProjectSourceFormState> {
  const actor = await auth();

  if (!actor) {
    return { error: 'Unauthorized.', success: false };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.type !== 'application/pdf') {
    return { error: 'Valid PDF file is required.', success: false };
  }

  const projectId = formData.get('projectId')?.toString() ?? '';
  const titleRaw = formData.get('title')?.toString()?.trim();
  const title = titleRaw || file.name;

  try {
    const deps = createProjectDeps();
    const source = await deps.projectSourceRepository.createForProjectOwner(
      projectId,
      actor.id,
      {
        content: `[PDF FILE: ${file.name}]`,
        title,
        type: 'pdf',
      }
    );

    if (!source) {
      return { error: 'Failed to create source record.', success: false };
    }

    if (!deps.evidenceKbService) throw new Error('Evidence KB service is not configured');
    await deps.evidenceKbService.ingestPdfForOwner({
      externalSourceId: source.id,
      file,
      ownerId: actor.id,
      projectId: projectId,
      title,
    });

    revalidatePath('/dashboard/projects');
    revalidatePath(`/dashboard/projects/${projectId}`);

    return { error: null, sourceId: source.id, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'PDF Upload failed.',
      success: false,
    };
  }
}

export async function updateProjectSourceFormAction(
  _state: ProjectSourceFormState,
  formData: FormData
): Promise<ProjectSourceFormState> {
  const actor = await auth();

  if (!actor) {
    return { error: 'Unauthorized.', success: false };
  }

  const parsed = safeParse(updateProjectSourceDto, {
    content: formData.get('content')?.toString() ?? '',
    sourceId: formData.get('sourceId')?.toString() ?? '',
    title: formData.get('title')?.toString() ?? '',
    type: formData.get('type')?.toString() || 'markdown',
  });

  if (!parsed.success) {
    return { error: 'Source title and content are required.', success: false };
  }

  try {
    const deps = createProjectDeps();
    const source = await updateProjectSource(parsed.output, deps, actor);

    revalidatePath(`/dashboard/projects/${source.projectId}`);

    return { error: null, sourceId: source.id, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Source update failed.',
      success: false,
    };
  }
}

export async function deleteProjectSourceFormAction(
  _state: ProjectSourceFormState,
  formData: FormData
): Promise<ProjectSourceFormState> {
  const actor = await auth();

  if (!actor) {
    return { error: 'Unauthorized.', success: false };
  }

  const parsed = safeParse(deleteProjectSourceDto, {
    sourceId: formData.get('sourceId')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Source is required.', success: false };
  }

  try {
    const deps = createProjectDeps();
    const existingSource = await deps.projectSourceRepository.findByIdForOwner(
      parsed.output.sourceId,
      actor.id
    );

    if (!existingSource) {
      return { error: 'Unauthorized.', success: false };
    }

    const source = await deleteProjectSource(parsed.output, deps, actor);

    if (deps.evidenceKbService) {
      try {
        await deps.evidenceKbService.deleteSourceForOwner({
          ownerId: actor.id,
          projectId: source.projectId,
          sourceId: source.id,
        });
      } catch (err) {
        // Best effort: Log the error but don't fail the source deletion
        console.error('Failed to delete source from Evidence KB:', err);
      }
    }

    revalidatePath(`/dashboard/projects/${source.projectId}`);

    return { error: null, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Source deletion failed.',
      success: false,
    };
  }
}

// --- Knowledgebase search ---

export type EvidenceKbSourcesResult =
  | { configured: false; error: string; sources: [] }
  | { configured: true; error: null; sources: EvidenceKbSource[] };

export type EvidenceKbPassagesResult =
  | { success: true; data: PaginatedPassagesResponse }
  | { success: false; error: string };

export async function listEvidenceKbSourcesAction(
  projectId: string
): Promise<EvidenceKbSourcesResult> {
  const actor = await auth();

  if (!actor) {
    throw new Error('Unauthorized');
  }

  const deps = createProjectDeps();

  if (!deps.evidenceKbService) {
    return {
      configured: false,
      error: 'Evidence KB service is not configured.',
      sources: [],
    };
  }

  const sources = await deps.evidenceKbService.listSourcesForOwner({
    ownerId: actor.id,
    projectId,
  });

  return { configured: true, error: null, sources };
}

export async function listEvidenceKbPassagesAction(input: {
  projectId: string;
  sourceId: string;
  query?: string;
  status?: string;
  retrieval_enabled?: boolean;
  sort_field?: string;
  sort_direction?: string;
  skip?: number;
  limit?: number;
}): Promise<EvidenceKbPassagesResult> {
  const actor = await auth();
  if (!actor) {
    return { success: false, error: 'Unauthorized' };
  }

  const deps = createProjectDeps();
  if (!deps.evidenceKbService) {
    return {
      success: false,
      error: 'Evidence KB service is not configured.',
    };
  }

  const data = await deps.evidenceKbService.listPassagesForOwner({
    ownerId: actor.id,
    projectId: input.projectId,
    sourceId: input.sourceId,
    query: input.query,
    status: input.status,
    retrievalEnabled: input.retrieval_enabled,
    offset: input.skip,
    limit: input.limit,
  });

  return { success: true, data };
}

export type EvidenceKbCurationResult =
  | { configured: false; error: string; results: [] }
  | {
      configured: true;
      error: null;
      results: Array<{ action: unknown; error?: string; ok: boolean }>;
    };

export async function applyEvidenceKbCurationAction(input: {
  actions: EvidenceKbCurationAction[];
  projectId: string;
}): Promise<EvidenceKbCurationResult> {
  const actor = await auth();

  if (!actor) {
    throw new Error('Unauthorized');
  }

  const deps = createProjectDeps();

  if (!deps.evidenceKbService) {
    return {
      configured: false,
      error: 'Evidence KB service is not configured.',
      results: [],
    };
  }

  const result = await deps.evidenceKbService.applyCurationForOwner({
    actions: input.actions,
    ownerId: actor.id,
    projectId: input.projectId,
  });

  revalidatePath(`/dashboard/projects/${input.projectId}`);

  return { configured: true, error: null, results: result.results };
}

export type EvidenceKbBulkCurationResult =
  | { configured: false; error: string; results: null }
  | {
      configured: true;
      error: null;
      results: {
        total: number;
        succeeded: number;
        failed: number;
        results: Array<{ action: unknown; error?: string; ok: boolean }>;
      };
    };

export async function bulkEvidenceKbCurationAction(input: {
  actions: EvidenceKbCurationAction[];
  projectId: string;
}): Promise<EvidenceKbBulkCurationResult> {
  const actor = await auth();

  if (!actor) {
    throw new Error('Unauthorized');
  }

  const deps = createProjectDeps();

  if (!deps.evidenceKbService) {
    return {
      configured: false,
      error: 'Evidence KB service is not configured.',
      results: null,
    };
  }

  const result = await deps.evidenceKbService.bulkCurationForOwner({
    actions: input.actions,
    ownerId: actor.id,
    projectId: input.projectId,
  });

  revalidatePath(`/dashboard/projects/${input.projectId}`);

  return { configured: true, error: null, results: result };
}

export type EvidenceKbExportResult =
  | { configured: false; error: string; passages: null }
  | {
      configured: true;
      error: null;
      passages: Array<{
        id: string;
        source_id: string;
        text: string;
        status?: string;
        quality_score: number;
        quality_warnings?: string[];
        retrieval_enabled?: boolean;
        token_count: number;
      }>;
      total: number;
    };

export async function exportEvidenceKbPassagesAction(input: {
  projectId: string;
  sourceId?: string;
  status?: string;
}): Promise<EvidenceKbExportResult> {
  const actor = await auth();

  if (!actor) {
    throw new Error('Unauthorized');
  }

  const deps = createProjectDeps();

  if (!deps.evidenceKbService) {
    return {
      configured: false,
      error: 'Evidence KB service is not configured.',
      passages: null,
    };
  }

  const result = await deps.evidenceKbService.exportPassagesForOwner({
    ownerId: actor.id,
    projectId: input.projectId,
    sourceId: input.sourceId,
    status: input.status,
  });

  return { configured: true, error: null, passages: result.passages, total: result.total };
}

export type EvidenceKbRetrieveResult =
  | { configured: false; error: string; retrieval: null }
  | { configured: true; error: null; retrieval: EvidenceKbRetrieveResponse };

export async function retrieveEvidenceKbAction(input: {
  filters?: Record<string, unknown>;
  mode?: 'hybrid' | 'bm25_only' | 'vector_only';
  projectId: string;
  query: string;
  topK?: number;
}): Promise<EvidenceKbRetrieveResult> {
  const actor = await auth();

  if (!actor) {
    throw new Error('Unauthorized');
  }

  const deps = createProjectDeps();

  if (!deps.evidenceKbService) {
    return {
      configured: false,
      error: 'Evidence KB service is not configured.',
      retrieval: null,
    };
  }

  const retrieval = await deps.evidenceKbService.retrieveForOwner({
    filters: input.filters,
    mode: input.mode,
    ownerId: actor.id,
    projectId: input.projectId,
    query: input.query,
    topK: input.topK,
  });

  return { configured: true, error: null, retrieval };
}

export async function getEvidenceKbSourceViewerUrlAction(input: {
  projectId: string;
  sourceId: string;
}): Promise<{ url?: string; html?: string } | null> {
  const actor = await auth();

  if (!actor) {
    return null;
  }

  const deps = createProjectDeps();

  if (!deps.evidenceKbService) {
    return null;
  }

  try {
    const result = await deps.evidenceKbService.getSourceViewerUrlForOwner({
      ownerId: actor.id,
      sourceId: input.sourceId,
    });
    return result;
  } catch (error) {
    console.error('Failed to get viewer URL:', error);
    return null;
  }
}

export async function getConceptGraphAction(input: {
  projectId: string;
  minWeight?: number;
}) {
  const actor = await auth();

  if (!actor) {
    throw new Error('Unauthorized');
  }

  const deps = createProjectDeps();

  if (!deps.evidenceKbService) {
    throw new Error('Evidence KB service is not configured');
  }

  try {
    return await deps.evidenceKbService.getConceptGraphForOwner({
      ownerId: actor.id,
      projectId: input.projectId,
      minWeight: input.minWeight,
    });
  } catch (error) {
    console.error('Failed to fetch concept graph:', error);
    throw new Error('Failed to fetch concept graph');
  }
}


export async function getProjectIngestionRunsAction(projectId: string) {
  const actor = await auth();
  if (!actor) {
    throw new Error('Unauthorized');
  }

  const deps = createProjectDeps();

  if (!deps.evidenceKbService) {
    throw new Error('Evidence KB service is not configured');
  }

  try {
    const runs = await deps.evidenceKbService.listRunsForProjectOwner({
      projectId,
      ownerId: actor.id,
    });
    
    // Map to domain format matching loadProjectDetail fetcher
    return runs.map((run: {
      id: string;
      project_id: string;
      external_source_id?: string;
      source_id: string;
      tenant_id: string;
      status: string;
      failure_reason?: string | null;
      stats?: Record<string, unknown>;
       
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      started_at?: string | Date | null | any;
       
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      completed_at?: string | Date | null | any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      created_at?: string | Date | null | any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updated_at?: string | Date | null | any;
    }) => ({
      id: run.id,
      projectId: run.project_id,
      sourceId: run.external_source_id ?? run.source_id,
      tenantId: run.tenant_id,
      status: (run.status === 'queued' || run.status === 'processing' ? 'ingesting' : run.status) as 'failed' | 'completed' | 'ingesting',
      failureReason: run.failure_reason ?? null,
      metadata: run.stats ?? {},
      startedAt: run.started_at ? new Date(run.started_at) : new Date(),
      completedAt: run.completed_at ? new Date(run.completed_at) : null,
      createdAt: run.created_at ? new Date(run.created_at) : new Date(),
      updatedAt: run.updated_at ? new Date(run.updated_at) : new Date(),
    }));
  } catch (error) {
    console.error('Failed to fetch ingestion runs:', error);
    return [];
  }
}

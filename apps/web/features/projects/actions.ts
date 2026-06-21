'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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
import { serverEnv } from '@/server/env';
import type {
  EvidenceKbCurationAction,
  EvidenceKbPassage,
  EvidenceKbRetrieveResponse,
  EvidenceKbSource,
} from '@/server/evidence-kb-service';
import { createProjectDeps } from '@/server/project-deps';

// --- Form state types ---

export type CreateProjectFormState = {
  error: string | null;
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
};

// --- Project form actions ---

export async function createProjectFormAction(
  _state: CreateProjectFormState,
  formData: FormData
): Promise<CreateProjectFormState> {
  const actor = await auth();

  if (!canCreateProject(actor)) {
    return { error: 'Unauthorized.' };
  }

  const parsed = safeParse(createProjectDto, {
    description: formData.get('description')?.toString().trim() || undefined,
    title: formData.get('title')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Please check the project fields.' };
  }

  await createProject(parsed.output, createProjectDeps(), actor.id);

  revalidatePath('/dashboard/projects');

  return { error: null };
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
    const project = await deps.projectRepository.findByIdForOwner(parsed.output.projectId, actor.id);

    if (!project) {
      return { error: 'Unauthorized.' };
    }

    if (project.status === PROJECT_STATUS.PROCESSING) {
      return { error: 'Project cannot be deleted while processing.' };
    }

    await deleteProject(parsed.output, deps, actor);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Project deletion failed.',
    };
  }

  revalidatePath('/dashboard/projects');
  redirect('/dashboard/projects');
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

    revalidatePath(`/dashboard/projects/${source.projectId}`);

    return { error: null, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Source deletion failed.',
      success: false,
    };
  }
}

// --- Evidence query actions ---

export async function getConceptEvidence(projectId: string, conceptId: string) {
  return [];
}

// --- Knowledgebase search ---

export type EvidenceKbSourcesResult =
  | { configured: false; error: string; sources: [] }
  | { configured: true; error: null; sources: EvidenceKbSource[] };

export type EvidenceKbPassagesResult =
  | { configured: false; error: string; passages: [] }
  | { configured: true; error: null; passages: EvidenceKbPassage[] };

export async function listEvidenceKbSourcesAction(projectId: string): Promise<EvidenceKbSourcesResult> {
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
}): Promise<EvidenceKbPassagesResult> {
  const actor = await auth();

  if (!actor) {
    throw new Error('Unauthorized');
  }

  const deps = createProjectDeps();

  if (!deps.evidenceKbService) {
    return {
      configured: false,
      error: 'Evidence KB service is not configured.',
      passages: [],
    };
  }

  const passages = await deps.evidenceKbService.listPassagesForOwner({
    ownerId: actor.id,
    projectId: input.projectId,
    sourceId: input.sourceId,
  });

  return { configured: true, error: null, passages };
}

export type EvidenceKbCurationResult =
  | { configured: false; error: string; results: [] }
  | { configured: true; error: null; results: Array<{ action: unknown; error?: string; ok: boolean }> };

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
        status: string;
        quality_score: number;
        quality_warnings: string[];
        retrieval_enabled: boolean;
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

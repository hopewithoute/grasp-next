'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  addProjectSource,
  addProjectSourceDto,
  addProjectSourceFromUrl,
  addProjectSourceFromUrlDto,
  applyGraphProposals,
  canCreateProject,
  createProject,
  createProjectDto,
  deleteProject,
  deleteProjectDto,
  deleteProjectSource,
  deleteProjectSourceDto,
  loadConceptEvidence,
  PROJECT_STATUS,
  safeParse,
  updateProjectDetails,
  updateProjectDetailsDto,
  updateProjectSource,
  updateProjectSourceDto,
  type GraphProposalAction,
  type KnowledgebaseGraphConceptReadModel,
} from '@grasp/domain';
import { getActor as auth } from '@/server/actor';
import { serverEnv } from '@/server/env';
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

    if (serverEnv.LGS_ENABLED === 'true') {
      if (!deps.lgsService) {
        return { error: 'LGS service is not configured.' };
      }

      await deps.lgsService.deleteCollectionForOwner({
        ownerId: actor.id,
        projectId: project.id,
      });
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

    if (serverEnv.LGS_ENABLED === 'true') {
      if (!deps.lgsService) {
        return { error: 'LGS service is not configured.', success: false };
      }

      await deps.lgsService.deleteSourceForOwner({
        ownerId: actor.id,
        projectId: existingSource.projectId,
        sourceId: existingSource.id,
      });
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
  const actor = await auth();

  if (!actor) {
    redirect('/sign-in');
  }

  const deps = createProjectDeps();

  try {
    const project = await deps.projectRepository.findByIdForOwner(projectId, actor.id);

    if (!project) {
      throw new Error('Unauthorized');
    }

    const evidence = await loadConceptEvidence(
      { conceptId, projectId, ownerId: actor.id },
      { knowledgebaseRepository: deps.knowledgebaseRepository }
    );
    return evidence;
  } catch (error) {
    console.error('Failed to load concept evidence', error);
    return [];
  }
}

// --- Graph proposal action ---

export async function executeGraphProposalAction(
  projectId: string,
  proposalActions: GraphProposalAction[]
) {
  const actor = await auth();
  if (!actor) throw new Error('Unauthorized');

  const deps = createProjectDeps();
  const project = await deps.projectRepository.findByIdForOwner(projectId, actor.id);

  if (!project) {
    throw new Error('Unauthorized');
  }

  const result = await applyGraphProposals(
    { projectId, actions: proposalActions },
    { knowledgebaseRepository: deps.knowledgebaseRepository }
  );

  revalidatePath(`/dashboard/projects/${projectId}`);

  return result;
}

// --- Knowledgebase search ---

export type ConceptSearchPaginationParams = {
  projectId: string;
  query?: string;
  difficulty?: string;
  limit?: number;
  offset?: number;
};

export async function searchKnowledgebaseConceptsAction(params: ConceptSearchPaginationParams) {
  const actor = await auth();

  if (!actor) {
    throw new Error('Unauthorized');
  }

  const deps = createProjectDeps();
  const project = await deps.projectRepository.findByIdForOwner(params.projectId, actor.id);

  if (!project) {
    throw new Error('Unauthorized');
  }

  if (serverEnv.LGS_ENABLED === 'true') {
    if (!deps.lgsService) {
      throw new Error('LGS service is not configured');
    }

    const graph = await deps.lgsService.getLocalGraphForOwner({
      limit: 500,
      ownerId: actor.id,
      projectId: params.projectId,
    });
    const normalizedQuery = params.query?.trim().toLowerCase();
    const filteredConcepts = graph.concepts.filter((concept: KnowledgebaseGraphConceptReadModel) => {
      const matchesQuery = normalizedQuery
        ? concept.name.toLowerCase().includes(normalizedQuery) ||
          concept.definition.toLowerCase().includes(normalizedQuery)
        : true;
      const matchesDifficulty = params.difficulty
        ? concept.difficulty === params.difficulty
        : true;

      return matchesQuery && matchesDifficulty;
    });
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 20;

    return {
      concepts: filteredConcepts.slice(offset, offset + limit),
      totalCount: filteredConcepts.length,
    };
  }

  if (serverEnv.LEGACY_KNOWLEDGEBASE_READS_ENABLED !== 'true') {
    throw new Error(
      'LGS concept search is disabled. Set LEGACY_KNOWLEDGEBASE_READS_ENABLED=true to use legacy concept search.'
    );
  }

  return deps.knowledgebaseRepository.searchConceptsWithPagination({
    projectId: params.projectId,
    query: params.query,
    difficulty: params.difficulty,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
  });
}

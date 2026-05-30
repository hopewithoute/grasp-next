'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  addProjectSource,
  addProjectSourceDto,
  canCreateProject,
  createProject,
  createProjectDto,
  deleteProjectSource,
  deleteProjectSourceDto,
  deleteProject,
  deleteProjectDto,
  updateKnowledgebaseConcept,
  updateKnowledgebaseConceptDto,
  updateKnowledgebaseConceptEvidence,
  updateKnowledgebaseConceptEvidenceDto,
  updateKnowledgebaseRelationship,
  updateKnowledgebaseRelationshipDto,
  updateKnowledgebaseRelationshipEvidence,
  updateKnowledgebaseRelationshipEvidenceDto,
  updateProjectSource,
  updateProjectSourceDto,
  updateProjectDetails,
  updateProjectDetailsDto,
  loadConceptEvidence,
  loadRelationshipEvidence,
  applyGraphProposals,
  type GraphProposalAction,
} from '@grasp/domain';
import { getActor as auth } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';

// --- Form state types ---

export type CreateProjectFormState = {
  error: string | null;
};

export type ProjectSourceFormState = {
  error: string | null;
  sourceId?: string;
  success: boolean;
};

export type UpdateProjectDetailsFormState = {
  error: string | null;
  success: boolean;
};

export type DeleteProjectFormState = {
  error: string | null;
};

export type KnowledgebaseConceptFormState = {
  error: string | null;
  success: boolean;
};

export type KnowledgebaseRelationshipFormState = {
  error: string | null;
  success: boolean;
};

export type KnowledgebaseEvidenceFormState = {
  error: string | null;
  success: boolean;
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

  const parsed = createProjectDto.safeParse({
    description: formData.get('description')?.toString().trim() || undefined,
    title: formData.get('title')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Please check the project fields.' };
  }

  await createProject(parsed.data, createProjectDeps(), actor.id);

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

  const parsed = deleteProjectDto.safeParse({
    projectId: formData.get('projectId')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Project ID is required.' };
  }

  try {
    await deleteProject(parsed.data, createProjectDeps(), actor);

    revalidatePath('/dashboard/projects');

    return { error: null };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Project deletion failed.',
    };
  }
}

export async function updateProjectDetailsFormAction(
  _state: UpdateProjectDetailsFormState,
  formData: FormData
): Promise<UpdateProjectDetailsFormState> {
  const actor = await auth();

  if (!actor) {
    return { error: 'Unauthorized.', success: false };
  }

  const parsed = updateProjectDetailsDto.safeParse({
    description: formData.get('description')?.toString().trim() || undefined,
    projectId: formData.get('projectId')?.toString() ?? '',
    title: formData.get('title')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Please check the project fields.', success: false };
  }

  try {
    await updateProjectDetails(parsed.data, createProjectDeps(), actor);

    revalidatePath(`/dashboard/projects/${parsed.data.projectId}`);

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

  const parsed = addProjectSourceDto.safeParse({
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
    const source = await addProjectSource(parsed.data, deps, actor);

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

export async function updateProjectSourceFormAction(
  _state: ProjectSourceFormState,
  formData: FormData
): Promise<ProjectSourceFormState> {
  const actor = await auth();

  if (!actor) {
    return { error: 'Unauthorized.', success: false };
  }

  const parsed = updateProjectSourceDto.safeParse({
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
    const source = await updateProjectSource(parsed.data, deps, actor);

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

  const parsed = deleteProjectSourceDto.safeParse({
    sourceId: formData.get('sourceId')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Source is required.', success: false };
  }

  try {
    const deps = createProjectDeps();
    const source = await deleteProjectSource(parsed.data, deps, actor);

    revalidatePath(`/dashboard/projects/${source.projectId}`);

    return { error: null, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Source deletion failed.',
      success: false,
    };
  }
}

// --- Knowledgebase form actions ---

export async function updateKnowledgebaseConceptFormAction(
  _state: KnowledgebaseConceptFormState,
  formData: FormData
): Promise<KnowledgebaseConceptFormState> {
  const actor = await auth();

  if (!actor) {
    return { error: 'Unauthorized.', success: false };
  }

  const parsed = updateKnowledgebaseConceptDto.safeParse({
    conceptKey: formData.get('conceptKey')?.toString() ?? '',
    confidence: formData.get('confidence')?.toString() ?? undefined,
    definition: formData.get('definition')?.toString() ?? undefined,
    difficulty: formData.get('difficulty')?.toString() ?? undefined,
    name: formData.get('name')?.toString() ?? undefined,
    projectId: formData.get('projectId')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Please check the concept fields.', success: false };
  }

  try {
    const artifact = await updateKnowledgebaseConcept(
      parsed.data,
      createProjectDeps(),
      actor
    );

    revalidatePath(`/dashboard/projects/${artifact.projectId}`);

    return { error: null, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Knowledgebase concept update failed.',
      success: false,
    };
  }
}

export async function updateKnowledgebaseConceptEvidenceFormAction(
  _state: KnowledgebaseEvidenceFormState,
  formData: FormData
): Promise<KnowledgebaseEvidenceFormState> {
  const actor = await auth();

  if (!actor) {
    return { error: 'Unauthorized.', success: false };
  }

  const parsed = updateKnowledgebaseConceptEvidenceDto.safeParse({
    evidenceId: formData.get('evidenceId')?.toString() ?? '',
    locationLabel: formData.get('locationLabel')?.toString() ?? undefined,
    quote: formData.get('quote')?.toString() ?? undefined,
  });

  if (!parsed.success) {
    return { error: 'Please check the evidence fields.', success: false };
  }

  try {
    const artifact = await updateKnowledgebaseConceptEvidence(
      parsed.data,
      createProjectDeps(),
      actor
    );

    revalidatePath(`/dashboard/projects/${artifact.projectId}`);

    return { error: null, success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Knowledgebase concept evidence update failed.',
      success: false,
    };
  }
}

export async function updateKnowledgebaseRelationshipFormAction(
  _state: KnowledgebaseRelationshipFormState,
  formData: FormData
): Promise<KnowledgebaseRelationshipFormState> {
  const actor = await auth();

  if (!actor) {
    return { error: 'Unauthorized.', success: false };
  }

  const parsed = updateKnowledgebaseRelationshipDto.safeParse({
    metadata: formData.get('metadata')?.toString() ?? undefined,
    projectId: formData.get('projectId')?.toString() ?? '',
    relationshipKey: formData.get('relationshipKey')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Please check the relationship fields.', success: false };
  }

  try {
    const artifact = await updateKnowledgebaseRelationship(
      parsed.data,
      createProjectDeps(),
      actor
    );

    revalidatePath(`/dashboard/projects/${artifact.projectId}`);

    return { error: null, success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Knowledgebase relationship update failed.',
      success: false,
    };
  }
}

export async function updateKnowledgebaseRelationshipEvidenceFormAction(
  _state: KnowledgebaseEvidenceFormState,
  formData: FormData
): Promise<KnowledgebaseEvidenceFormState> {
  const actor = await auth();

  if (!actor) {
    return { error: 'Unauthorized.', success: false };
  }

  const parsed = updateKnowledgebaseRelationshipEvidenceDto.safeParse({
    evidenceId: formData.get('evidenceId')?.toString() ?? '',
    locationLabel: formData.get('locationLabel')?.toString() ?? undefined,
    quote: formData.get('quote')?.toString() ?? undefined,
  });

  if (!parsed.success) {
    return { error: 'Please check the evidence fields.', success: false };
  }

  try {
    const artifact = await updateKnowledgebaseRelationshipEvidence(
      parsed.data,
      createProjectDeps(),
      actor
    );

    revalidatePath(`/dashboard/projects/${artifact.projectId}`);

    return { error: null, success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Knowledgebase relationship evidence update failed.',
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

export async function getRelationshipEvidence(projectId: string, relationshipId: string) {
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

    const evidence = await loadRelationshipEvidence(
      { relationshipId, projectId, ownerId: actor.id },
      { knowledgebaseRepository: deps.knowledgebaseRepository }
    );
    return evidence;
  } catch (error) {
    console.error('Failed to load relationship evidence', error);
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

  return deps.knowledgebaseRepository.searchConceptsWithPagination({
    projectId: params.projectId,
    query: params.query,
    difficulty: params.difficulty,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
  });
}

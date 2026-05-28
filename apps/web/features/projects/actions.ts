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
  addConceptProposalDto,
  updateConceptProposalDto,
  deleteConceptProposalDto,
  addRelationshipProposalDto,
  deleteRelationshipProposalDto,
  addEvidenceProposalDto,
  updateEvidenceProposalDto,
  deleteEvidenceProposalDto,
  type CreateProjectDto,
} from '@grasp/domain';
import { getActor as auth } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';

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

async function createProjectAction(input: CreateProjectDto) {
  const actor = await auth();

  if (!canCreateProject(actor)) {
    throw new Error('Unauthorized.');
  }

  const project = await createProject(input, createProjectDeps(), actor.id);

  revalidatePath('/dashboard/projects');

  return project;
}

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

    await deps.knowledgebaseRepository.cleanupDeletedSource({
      projectId: source.projectId,
      sourceId: source.id,
    });

    revalidatePath(`/dashboard/projects/${source.projectId}`);

    return { error: null, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Source deletion failed.',
      success: false,
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
    return { error: 'Please check the project details.', success: false };
  }

  try {
    const project = await updateProjectDetails(parsed.data, createProjectDeps(), actor);

    revalidatePath('/dashboard/projects');
    revalidatePath(`/dashboard/projects/${project.id}`);

    return { error: null, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Project details update failed.',
      success: false,
    };
  }
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
    return { error: 'Project is required.' };
  }

  try {
    await deleteProject(parsed.data, createProjectDeps(), actor);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Project deletion failed.',
    };
  }

  revalidatePath('/dashboard/projects');
  redirect('/dashboard/projects');
}

export async function updateKnowledgebaseConceptFormAction(
  _state: KnowledgebaseConceptFormState,
  formData: FormData
): Promise<KnowledgebaseConceptFormState> {
  const actor = await auth();

  if (!actor) {
    return { error: 'Unauthorized.', success: false };
  }

  const parsed = updateKnowledgebaseConceptDto.safeParse({
    artifactId: formData.get('artifactId')?.toString() ?? '',
    conceptId: formData.get('conceptId')?.toString() ?? '',
    definition: formData.get('definition')?.toString() ?? '',
    difficulty: formData.get('difficulty')?.toString() ?? '',
    name: formData.get('name')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Concept name, definition, and difficulty are required.', success: false };
  }

  try {
    const artifact = await updateKnowledgebaseConcept(parsed.data, createProjectDeps(), actor);

    revalidatePath(`/dashboard/projects/${artifact.projectId}`);

    return { error: null, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Knowledgebase concept update failed.',
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
    artifactId: formData.get('artifactId')?.toString() ?? '',
    relationshipId: formData.get('relationshipId')?.toString() ?? '',
    relationshipType: formData.get('relationshipType')?.toString() ?? '',
    sourceConceptId: formData.get('sourceConceptId')?.toString() ?? '',
    targetConceptId: formData.get('targetConceptId')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Relationship source and target are required.', success: false };
  }

  try {
    const artifact = await updateKnowledgebaseRelationship(parsed.data, createProjectDeps(), actor);

    revalidatePath(`/dashboard/projects/${artifact.projectId}`);

    return { error: null, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Knowledgebase relationship update failed.',
      success: false,
    };
  }
}

export async function updateKnowledgebaseEvidenceFormAction(
  _state: KnowledgebaseEvidenceFormState,
  formData: FormData
): Promise<KnowledgebaseEvidenceFormState> {
  const actor = await auth();

  if (!actor) {
    return { error: 'Unauthorized.', success: false };
  }

  const parsed = updateKnowledgebaseConceptEvidenceDto.safeParse({
    artifactId: formData.get('artifactId')?.toString() ?? '',
    blockId: formData.get('blockId')?.toString() ?? '',
    conceptId: formData.get('conceptId')?.toString() ?? '',
    locationLabel: formData.get('locationLabel')?.toString() ?? '',
    originalBlockId: formData.get('originalBlockId')?.toString() ?? '',
    originalQuote: formData.get('originalQuote')?.toString() ?? '',
    originalSourceId: formData.get('originalSourceId')?.toString() ?? '',
    quote: formData.get('quote')?.toString() ?? '',
    sourceId: formData.get('sourceId')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Evidence quote, source block, and location are required.', success: false };
  }

  try {
    const artifact = await updateKnowledgebaseConceptEvidence(parsed.data, createProjectDeps(), actor);

    revalidatePath(`/dashboard/projects/${artifact.projectId}`);

    return { error: null, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Knowledgebase evidence update failed.',
      success: false,
    };
  }
}

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

export async function updateKnowledgebaseRelationshipEvidenceFormAction(
  _state: KnowledgebaseEvidenceFormState,
  formData: FormData
): Promise<KnowledgebaseEvidenceFormState> {
  const actor = await auth();

  if (!actor) {
    return { error: 'Unauthorized.', success: false };
  }

  const parsed = updateKnowledgebaseRelationshipEvidenceDto.safeParse({
    artifactId: formData.get('artifactId')?.toString() ?? '',
    blockId: formData.get('blockId')?.toString() ?? '',
    locationLabel: formData.get('locationLabel')?.toString() ?? '',
    originalBlockId: formData.get('originalBlockId')?.toString() ?? '',
    originalQuote: formData.get('originalQuote')?.toString() ?? '',
    originalSourceId: formData.get('originalSourceId')?.toString() ?? '',
    quote: formData.get('quote')?.toString() ?? '',
    relationshipId: formData.get('relationshipId')?.toString() ?? '',
    sourceId: formData.get('sourceId')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Evidence quote, source block, and location are required.', success: false };
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

export async function executeGraphProposalAction(
  projectId: string,
  actions: { type: string; payload: Record<string, unknown> }[]
) {
  const actor = await auth();
  if (!actor) throw new Error('Unauthorized');

  const deps = createProjectDeps();
  const project = await deps.projectRepository.findByIdForOwner(projectId, actor.id);

  if (!project) {
    throw new Error('Unauthorized');
  }

  for (const action of actions) {
    switch (action.type) {
      case 'add_concept': {
        const payload = addConceptProposalDto.parse(action.payload);
        await deps.knowledgebaseRepository.addConcept({ projectId, ...payload });
        break;
      }
      case 'update_concept': {
        const payload = updateConceptProposalDto.parse(action.payload);
        await deps.knowledgebaseRepository.updateConcept({ projectId, ...payload });
        break;
      }
      case 'delete_concept': {
        const payload = deleteConceptProposalDto.parse(action.payload);
        await deps.knowledgebaseRepository.deleteConcept({ projectId, conceptKey: payload.conceptKey });
        break;
      }
      case 'add_relationship': {
        const payload = addRelationshipProposalDto.parse(action.payload);
        await deps.knowledgebaseRepository.addRelationship({
          projectId,
          relationshipKey: `${payload.sourceConceptKey}:${payload.targetConceptKey}:${payload.relationshipType}`,
          ...payload
        });
        break;
      }
      case 'delete_relationship': {
        const payload = deleteRelationshipProposalDto.parse(action.payload);
        await deps.knowledgebaseRepository.deleteRelationship({
          projectId,
          relationshipKey: `${payload.sourceConceptKey}:${payload.targetConceptKey}:${payload.relationshipType}`
        });
        break;
      }
      case 'add_evidence': {
        const payload = addEvidenceProposalDto.parse(action.payload);
        await deps.knowledgebaseRepository.addConceptEvidence({
          projectId,
          conceptKey: payload.conceptKey,
          sourceType: (payload.sourceType === 'text' ? 'text' : 'web'),
          title: payload.title || 'Agent Search Result',
          url: payload.url,
          quote: payload.evidenceText,
          locationLabel: 'AI Extracted'
        });
        break;
      }
      case 'update_evidence': {
        const payload = updateEvidenceProposalDto.parse(action.payload);
        await deps.knowledgebaseRepository.updateConceptEvidence({
          projectId,
          evidenceId: payload.evidenceId,
          quote: payload.evidenceText,
        });
        break;
      }
      case 'delete_evidence': {
        const payload = deleteEvidenceProposalDto.parse(action.payload);
        await deps.knowledgebaseRepository.deleteConceptEvidence({
          projectId,
          evidenceId: payload.evidenceId,
        });
        break;
      }
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  await deps.knowledgebaseRepository.createSnapshot({
    projectId,
    trigger: 'agent_refinement_proposal_approval',
  });

  revalidatePath(`/dashboard/projects/${projectId}`);

  return { success: true, applied: actions.length };
}

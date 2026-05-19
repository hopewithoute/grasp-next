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
  updateProjectSource,
  updateProjectSourceDto,
  updateProjectDetails,
  updateProjectDetailsDto,
  type CreateProjectDto,
} from '@grasp/domain';
import { getActor } from '@/server/actor';
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

export async function createProjectAction(input: CreateProjectDto) {
  const actor = await getActor();

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
  const actor = await getActor();

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
  const actor = await getActor();

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
  const actor = await getActor();

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
  const actor = await getActor();

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
  const actor = await getActor();

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
  const actor = await getActor();

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
  const actor = await getActor();

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

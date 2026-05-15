'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  approveArtifact,
  approveArtifactDto,
  canCreateProject,
  createProject,
  createProjectDto,
  deleteProject,
  deleteProjectDto,
  requestConceptRevision,
  requestConceptRevisionDto,
  submitSourceMaterial,
  updateProjectDetails,
  updateProjectDetailsDto,
  updateSourceMaterialDto,
  type CreateProjectDto,
  type UpdateSourceMaterialDto,
} from '@grasp/domain';
import { getActor } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';

export type CreateProjectFormState = {
  error: string | null;
};

export type SourceMaterialFormState = {
  error: string | null;
  success: boolean;
};

export type ApproveArtifactFormState = {
  error: string | null;
  success: boolean;
};

export type RequestConceptRevisionFormState = {
  error: string | null;
  success: boolean;
};

export type UpdateProjectDetailsFormState = {
  error: string | null;
  success: boolean;
};

export type DeleteProjectFormState = {
  error: string | null;
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
    sourceMaterial: formData.get('sourceMaterial')?.toString().trim() || undefined,
    title: formData.get('title')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Please check the project fields.' };
  }

  await createProject(parsed.data, createProjectDeps(), actor.id);

  revalidatePath('/dashboard/projects');

  return { error: null };
}

export async function submitSourceMaterialAction(input: UpdateSourceMaterialDto) {
  const actor = await getActor();

  if (!actor) {
    throw new Error('Unauthorized.');
  }

  const project = await submitSourceMaterial(input, createProjectDeps(), actor);

  revalidatePath(`/dashboard/projects/${project.id}`);

  return project;
}

export async function submitSourceMaterialFormAction(
  _state: SourceMaterialFormState,
  formData: FormData
): Promise<SourceMaterialFormState> {
  const actor = await getActor();

  if (!actor) {
    return { error: 'Unauthorized.', success: false };
  }

  const parsed = updateSourceMaterialDto.safeParse({
    projectId: formData.get('projectId')?.toString() ?? '',
    sourceMaterial: formData.get('sourceMaterial')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Source material is required.', success: false };
  }

  try {
    const project = await submitSourceMaterial(parsed.data, createProjectDeps(), actor);

    revalidatePath('/dashboard/projects');
    revalidatePath(`/dashboard/projects/${project.id}`);

    return { error: null, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Source material failed.',
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

export async function approveArtifactAction(input: { artifactId: string }) {
  const actor = await getActor();

  if (!actor) {
    throw new Error('Unauthorized.');
  }

  const artifact = await approveArtifact(input, createProjectDeps(), actor);

  revalidatePath(`/dashboard/projects/${artifact.projectId}`);

  return artifact;
}

export async function approveArtifactFormAction(
  _state: ApproveArtifactFormState,
  formData: FormData
): Promise<ApproveArtifactFormState> {
  const actor = await getActor();

  if (!actor) {
    return { error: 'Unauthorized.', success: false };
  }

  const parsed = approveArtifactDto.safeParse({
    artifactId: formData.get('artifactId')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Artifact is required.', success: false };
  }

  try {
    const artifact = await approveArtifact(parsed.data, createProjectDeps(), actor);

    revalidatePath(`/dashboard/projects/${artifact.projectId}`);

    return { error: null, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Artifact approval failed.',
      success: false,
    };
  }
}

export async function requestConceptRevisionFormAction(
  _state: RequestConceptRevisionFormState,
  formData: FormData
): Promise<RequestConceptRevisionFormState> {
  const actor = await getActor();

  if (!actor) {
    return { error: 'Unauthorized.', success: false };
  }

  const parsed = requestConceptRevisionDto.safeParse({
    artifactId: formData.get('artifactId')?.toString() ?? '',
    revisionFeedback: formData.get('revisionFeedback')?.toString() ?? '',
  });

  if (!parsed.success) {
    return { error: 'Revision feedback is required.', success: false };
  }

  try {
    const artifact = await requestConceptRevision(parsed.data, createProjectDeps(), actor);

    revalidatePath(`/dashboard/projects/${artifact.projectId}`);

    return { error: null, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Concept revision request failed.',
      success: false,
    };
  }
}

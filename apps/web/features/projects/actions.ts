"use server";

import { revalidatePath } from "next/cache";
import {
  canCreateProject,
  createProject,
  createProjectDto,
  submitSourceMaterial,
  updateSourceMaterialDto,
  type CreateProjectDto,
  type UpdateSourceMaterialDto,
} from "@grasp/domain";
import { getActor } from "@/server/actor";
import { createProjectDeps } from "@/server/project-deps";

export type CreateProjectFormState = {
  error: string | null;
};

export type SourceMaterialFormState = {
  error: string | null;
  success: boolean;
};

export async function createProjectAction(input: CreateProjectDto) {
  const actor = await getActor();

  if (!canCreateProject(actor)) {
    throw new Error("Unauthorized.");
  }

  const project = await createProject(input, createProjectDeps(), actor.id);

  revalidatePath("/dashboard/projects");

  return project;
}

export async function createProjectFormAction(
  _state: CreateProjectFormState,
  formData: FormData
): Promise<CreateProjectFormState> {
  const actor = await getActor();

  if (!canCreateProject(actor)) {
    return { error: "Unauthorized." };
  }

  const parsed = createProjectDto.safeParse({
    description: formData.get("description")?.toString().trim() || undefined,
    sourceMaterial: formData.get("sourceMaterial")?.toString().trim() || undefined,
    title: formData.get("title")?.toString() ?? "",
  });

  if (!parsed.success) {
    return { error: "Please check the project fields." };
  }

  await createProject(parsed.data, createProjectDeps(), actor.id);

  revalidatePath("/dashboard/projects");

  return { error: null };
}

export async function submitSourceMaterialAction(input: UpdateSourceMaterialDto) {
  const actor = await getActor();

  if (!actor) {
    throw new Error("Unauthorized.");
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
    return { error: "Unauthorized.", success: false };
  }

  const parsed = updateSourceMaterialDto.safeParse({
    projectId: formData.get("projectId")?.toString() ?? "",
    sourceMaterial: formData.get("sourceMaterial")?.toString() ?? "",
  });

  if (!parsed.success) {
    return { error: "Source material is required.", success: false };
  }

  try {
    const project = await submitSourceMaterial(
      parsed.data,
      createProjectDeps(),
      actor
    );

    revalidatePath("/dashboard/projects");
    revalidatePath(`/dashboard/projects/${project.id}`);

    return { error: null, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Source material failed.",
      success: false,
    };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import {
  canCreateProject,
  createProject,
  submitSourceMaterial,
  type CreateProjectDto,
  type UpdateSourceMaterialDto,
} from "@grasp/domain";
import { getActor } from "@/server/actor";
import { createProjectDeps } from "@/server/project-deps";

export async function createProjectAction(input: CreateProjectDto) {
  const actor = await getActor();

  if (!canCreateProject(actor)) {
    throw new Error("Unauthorized.");
  }

  const project = await createProject(input, createProjectDeps(), actor.id);

  revalidatePath("/dashboard/projects");

  return project;
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

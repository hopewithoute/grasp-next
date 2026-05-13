export type Actor = {
  id: string;
};

export function canCreateProject(actor: Actor | null | undefined): actor is Actor {
  return Boolean(actor?.id);
}

export function canEditOwnedProject(
  actor: Actor | null | undefined,
  project: { ownerId: string } | null | undefined
): actor is Actor {
  return Boolean(actor?.id && project?.ownerId === actor.id);
}

export const canEditProject = canEditOwnedProject;

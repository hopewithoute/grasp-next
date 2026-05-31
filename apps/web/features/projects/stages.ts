export const STAGE_ORDER = ['overview', 'workspace', 'lesson', 'publish'] as const;

export type StudioStage = (typeof STAGE_ORDER)[number];

export const STAGE_LABELS: Record<StudioStage, string> = {
  overview: 'Overview',
  workspace: 'Workspace',
  lesson: 'Lesson',
  publish: 'Publish',
};

export const STAGE_DESCRIPTIONS: Record<StudioStage, string> = {
  overview: 'Project status, pipeline progress, and next action.',
  workspace: 'Add sources and refine the concept graph.',
  lesson: 'Review objectives and lesson blocks when that slice ships.',
  publish: 'Run the publish gate once lesson review is ready.',
};

export function resolveStage(input?: string | null): StudioStage {
  if (input === 'source' || input === 'graph') return 'workspace';
  return STAGE_ORDER.includes(input as StudioStage) ? (input as StudioStage) : 'overview';
}

export function buildStageHref(projectId: string, stage: StudioStage): string {
  return `/dashboard/projects/${projectId}?stage=${stage}`;
}

export const STAGE_ORDER = ['overview', 'source', 'graph', 'lesson', 'publish'] as const;

export type StudioStage = (typeof STAGE_ORDER)[number];

export const STAGE_LABELS: Record<StudioStage, string> = {
  graph: 'Graph',
  lesson: 'Lesson',
  overview: 'Overview',
  publish: 'Publish',
  source: 'Source',
};

const STAGE_DESCRIPTIONS: Record<StudioStage, string> = {
  graph: 'Build, refine, and approve the concept graph.',
  lesson: 'Review objectives and lesson blocks when that slice ships.',
  overview: 'Project status, pipeline progress, and next action.',
  publish: 'Run the publish gate once lesson review is ready.',
  source: 'Add and maintain the source material.',
};

export function resolveStage(input?: string | null): StudioStage {
  return STAGE_ORDER.includes(input as StudioStage) ? (input as StudioStage) : 'overview';
}

export function buildStageHref(projectId: string, stage: StudioStage): string {
  return `/dashboard/projects/${projectId}?stage=${stage}`;
}

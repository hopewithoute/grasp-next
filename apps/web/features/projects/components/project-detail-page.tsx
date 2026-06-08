import { notFound, redirect, unstable_rethrow } from 'next/navigation';
import {
  loadProjectDetail,
  PROJECT_STATUS,
  ProjectForbiddenError,
  ProjectNotFoundError,
} from '@grasp/domain';
import { getActor } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';
import { ConceptGraphWorkspace } from '../concept-graph/components/concept-graph-workspace';
import type { ConceptRow, RelationshipRow } from '../concept-graph/types';
import { buildStageHref, resolveStage } from '../stages';
import { ProjectHeader } from './project-header';
import { ProjectPipelineStatus } from './project-pipeline-status';
import { ProjectSettings } from './project-settings';
import { Eyebrow } from './project-shared';
import { PlannedStagePanel } from './project-stage-panels';

type ProjectDetailPageProps = {
  currentStage?: string;
  projectId: string;
};

export async function ProjectDetailPage({ currentStage, projectId }: ProjectDetailPageProps) {
  const actor = await getActor();

  if (!actor) {
    redirect('/sign-in');
  }

  const deps = createProjectDeps();

  let detail;

  let isNotFound = false;

  try {
    detail = await loadProjectDetail(
      { projectId, ownerId: actor.id },
      {
        ingestionRunRepository: deps.ingestionRunRepository,
        knowledgebaseRepository: deps.knowledgebaseRepository,
        projectRepository: deps.projectRepository,
        projectSourceRepository: deps.projectSourceRepository,
      }
    );
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ProjectNotFoundError || error instanceof ProjectForbiddenError) {
      isNotFound = true;
    } else {
      throw error;
    }
  }

  if (isNotFound || !detail) {
    notFound();
  }

  const stage = resolveStage(currentStage);
  const sourceReady = detail.sources.some((source) => source.content?.trim());
  const knowledgebaseGraph = detail.knowledgebaseGraph;
  const graphReady = sourceReady && knowledgebaseGraph.concepts.length > 0;
  const sourceCounts = getSourceCounts(detail.sources);
  const ingestionStatus = getIngestionStatus(detail.latestIngestionRun);

  return (
    <section className="text-foreground flex w-full flex-col gap-10">
      {stage === 'overview' ? (
        <>
          <ProjectHeader
            detail={detail}
            graphReady={graphReady}
            knowledgebaseGraph={knowledgebaseGraph}
            sourceCounts={sourceCounts}
            sourceReady={sourceReady}
            ingestionStatus={ingestionStatus}
          />

          <ProjectSettings detail={detail} />
        </>
      ) : null}

      {detail.project.status === PROJECT_STATUS.FAILED && sourceReady ? (
        <section className="border-status-danger-border bg-status-danger-surface rounded-[1.5rem] border p-5">
          <div className="space-y-1">
            <p className="text-status-danger-foreground font-mono text-[0.65rem] tracking-[0.18em] uppercase tabular-nums">
              Pipeline failure
            </p>
            <h2 className="text-status-danger-foreground text-lg font-medium">
              Last graph build failed
            </h2>
            <p className="text-status-danger-foreground/82 text-sm leading-7">
              The source material is still saved. Start a new graph run from the workspace below
              after fixing provider or database errors.
            </p>
          </div>
        </section>
      ) : null}

      {stage === 'overview' ? (
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Eyebrow>Overview</Eyebrow>
              <h2 className="text-foreground max-w-[28ch] text-3xl leading-[1.05] font-medium tracking-[-0.03em] text-balance md:text-4xl">
                Project status and pipeline progress.
              </h2>
              <p className="text-muted-foreground max-w-[60ch] text-sm leading-relaxed text-pretty">
                Monitor the end-to-end knowledge base generation pipeline.
              </p>
            </div>
            <span className="border-border bg-card/50 text-muted-foreground inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.18em] uppercase">
              <span className="bg-brand-accent pulse-soft size-1.5 rounded-full" />
              Stage 01 / Overview
            </span>
          </header>
          <ProjectPipelineStatus
            graphReady={graphReady}
            knowledgebaseGraph={knowledgebaseGraph}
            projectId={projectId}
            sourceCounts={sourceCounts}
            sourceReady={sourceReady}
            ingestionStatus={ingestionStatus}
          />
        </div>
      ) : null}

      {stage === 'workspace' ? (
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Eyebrow>Unified workspace</Eyebrow>
              <h2 className="text-foreground max-w-[28ch] text-2xl leading-[1.05] font-medium tracking-[-0.03em] text-balance md:text-3xl">
                Ingest sources and refine the concept graph.
              </h2>
              <p className="text-muted-foreground max-w-[60ch] text-sm leading-relaxed text-pretty">
                Manage your documents on the left. The AI will extract concepts and propose them on
                the canvas for your approval.
              </p>
            </div>
            <span className="border-border bg-card/50 text-muted-foreground inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.18em] uppercase">
              <span className="bg-brand-accent pulse-soft size-1.5 rounded-full" />
              Stage 02 / Workspace
            </span>
          </header>
          <ConceptGraphWorkspace
            concepts={knowledgebaseGraph.concepts as unknown as ConceptRow[]}
            projectId={detail.project.id}
            relationships={knowledgebaseGraph.relationships as unknown as RelationshipRow[]}
            sources={detail.sources}
          />
        </div>
      ) : null}

      {stage === 'lesson' ? (
        <PlannedStagePanel
          blockers={[
            graphReady
              ? 'Concept graph is ready for downstream generation.'
              : 'Generate the concept graph before lesson generation opens.',
            'Learning objectives and lesson block generation are not implemented yet.',
            'Per-block revision and version history UI still belong to the next slice.',
          ]}
          ctaHref={buildStageHref(projectId, graphReady ? 'workspace' : 'overview')}
          ctaLabel={graphReady ? 'Review workspace' : 'Return to overview'}
          eyebrow="Lesson workspace"
          title="This stage is reserved for objective and block review."
        />
      ) : null}

      {stage === 'publish' ? (
        <PlannedStagePanel
          blockers={[
            graphReady
              ? 'Graph is in place.'
              : 'Graph must be generated before publish readiness matters.',
            'Lesson approval is not implemented yet.',
            'Learner preview and publish gate UI are still planned.',
          ]}
          ctaHref={buildStageHref(projectId, graphReady ? 'lesson' : 'workspace')}
          ctaLabel={graphReady ? 'Open lesson stage' : 'Open workspace'}
          eyebrow="Publish gate"
          title="Publish stays visible so the studio keeps the full end-to-end shape."
        />
      ) : null}
    </section>
  );
}

function getSourceCounts(sources: Array<{ content: string | null }>) {
  const value = sources
    .flatMap((source) => {
      const val = source.content?.trim();
      return val ? [val] : [];
    })
    .join('\n');

  return {
    characters: value.length,
    words: value ? value.split(/\s+/).length : 0,
  };
}

function getIngestionStatus(
  latestRun: {
    completedAt: Date | null;
    failureReason: string | null;
    startedAt: Date;
    status: 'ingesting' | 'completed' | 'failed';
  } | null
) {
  if (!latestRun) {
    return {
      hint: 'No ingestion run yet',
      ready: false,
      unit: 'waiting',
      value: 'none',
    };
  }

  if (latestRun.status === 'completed') {
    return {
      hint: latestRun.completedAt
        ? `Completed ${formatRelativeDate(latestRun.completedAt)}`
        : 'Knowledgebase projection is current',
      ready: true,
      unit: 'current',
      value: 'done',
    };
  }

  if (latestRun.status === 'failed') {
    return {
      hint: latestRun.failureReason ?? 'Last ingestion failed',
      ready: false,
      unit: 'failed',
      value: 'failed',
    };
  }

  return {
    hint: `Started ${formatRelativeDate(latestRun.startedAt)}`,
    ready: false,
    unit: 'running',
    value: 'active',
  };
}

const relativeDateFormatter = new Intl.DateTimeFormat('en', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
});

function formatRelativeDate(value: Date) {
  return relativeDateFormatter.format(value);
}

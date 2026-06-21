import { notFound, redirect, unstable_rethrow } from 'next/navigation';
import {
  loadProjectDetail,
  PROJECT_STATUS,
  ProjectForbiddenError,
  ProjectNotFoundError,
  type LoadProjectDetailResult,
} from '@grasp/domain';
import { getActor } from '@/server/actor';
import { serverEnv } from '@/server/env';
import { createProjectDeps } from '@/server/project-deps';
import { ConceptGraphWorkspace } from '../concept-graph/components/concept-graph-workspace';
import type { ConceptRow, RelationshipRow } from '../concept-graph/types';
import { buildStageHref, resolveStage } from '../stages';
import { ProjectHeader } from './project-header';
import { ProjectPipelineStatus } from './project-pipeline-status';
import { ProjectSettings } from './project-settings';
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

  let detail: LoadProjectDetailResult | undefined;

  let isNotFound = false;

  try {
    detail = await loadProjectDetail(
      { projectId, ownerId: actor.id },
      {
        ingestionRunRepository: deps.ingestionRunRepository,
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
        <section className="border-status-danger-border bg-status-danger-surface relative rounded-none border p-5">
          <div className="border-status-danger-border absolute top-0 left-0 size-2 border-t border-l" />
          <div className="border-status-danger-border absolute right-0 bottom-0 size-2 border-r border-b" />
          <div className="space-y-2">
            <p className="text-status-danger-foreground font-mono text-[0.65rem] tracking-widest uppercase tabular-nums">
              [ PIPELINE_FAILURE ]
            </p>
            <h2 className="text-status-danger-foreground font-mono text-lg tracking-widest uppercase">
              Last graph build failed
            </h2>
            <p className="text-status-danger-foreground/80 font-mono text-xs leading-relaxed tracking-wider uppercase">
              &gt; The source material is still saved. Start a new graph run from the workspace
              below after fixing provider or database errors.
            </p>
          </div>
        </section>
      ) : null}

      {stage === 'overview' ? (
        <div className="flex flex-col gap-8">
          <header className="border-border/40 mb-2 flex flex-col gap-5 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <span className="text-brand-accent/80 font-mono text-[0.65rem] tracking-[0.3em] uppercase">
                [ OVERVIEW ]
              </span>
              <h2 className="text-foreground max-w-[28ch] text-3xl leading-[1.05] font-light tracking-[-0.03em] uppercase md:text-4xl">
                Pipeline Progress.
              </h2>
              <p className="text-muted-foreground/70 max-w-[60ch] font-mono text-xs leading-relaxed">
                &gt; Monitor the end-to-end knowledge base generation pipeline.
              </p>
            </div>
            <span className="border-border/50 bg-background text-muted-foreground inline-flex items-center gap-3 self-start border px-4 py-2 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
              <span className="bg-brand-accent animate-pulse-soft size-1.5" />
              SEQ:01 / STATUS
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
          <header className="border-border/40 mb-2 flex flex-col gap-5 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <span className="text-brand-accent/80 font-mono text-[0.65rem] tracking-[0.3em] uppercase">
                [ WORKSPACE ]
              </span>
              <h2 className="text-foreground max-w-[28ch] text-2xl leading-[1.05] font-light tracking-[-0.03em] uppercase md:text-3xl">
                Ingest & Refine.
              </h2>
              <p className="text-muted-foreground/70 max-w-[60ch] font-mono text-xs leading-relaxed">
                &gt; Manage sources on the left.
                <br />
                &gt; AI extracts concepts to the canvas for verification.
              </p>
            </div>
            <span className="border-border/50 bg-background text-muted-foreground inline-flex items-center gap-3 self-start border px-4 py-2 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
              <span className="bg-brand-accent animate-pulse-soft size-1.5" />
              SEQ:02 / GRAPH
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
          ctaLabel={graphReady ? 'REVIEW_WORKSPACE' : 'RETURN_TO_OVERVIEW'}
          eyebrow="LESSON_WORKSPACE"
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
          ctaLabel={graphReady ? 'OPEN_LESSON_STAGE' : 'OPEN_WORKSPACE'}
          eyebrow="PUBLISH_GATE"
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

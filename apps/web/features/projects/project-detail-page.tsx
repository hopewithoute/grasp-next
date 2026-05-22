import { notFound, redirect, unstable_rethrow } from 'next/navigation';
import {
  loadProjectDetail,
  PROJECT_STATUS,
  ProjectForbiddenError,
  ProjectNotFoundError,
} from '@grasp/domain';
import { getActor } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';
import { ConceptGraphWorkspace } from './concept-graph-workspace';
import { ProjectSourcesPanel } from './source-material-form';
import { buildStageHref, resolveStage, type StudioStage } from './stages';
import { ProjectHeader } from './components/project-header';
import { ProjectSettings } from './components/project-settings';
import { ProjectPipelineStatus } from './components/project-pipeline-status';
import { IngestionStatusPanel, PlannedStagePanel } from './components/project-stage-panels';
import { Eyebrow } from './components/project-shared';

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
      notFound();
    }

    throw error;
  }

  const stage = resolveStage(currentStage);
  const sourceReady = detail.sources.some((source) => source.content?.trim());
  const knowledgebaseGraph = detail.knowledgebaseGraph;
  const graphReady = sourceReady && knowledgebaseGraph.concepts.length > 0;
  const sourceCounts = getSourceCounts(detail.sources);
  const ingestionStatus = getIngestionStatus(detail.latestIngestionRun);
  const nextAction = getNextAction({
    graphReady,
    sourceReady,
  });

  return (
    <section className="flex w-full flex-col gap-10 text-foreground">
      <ProjectHeader
        detail={detail}
        graphReady={graphReady}
        ingestionStatus={ingestionStatus}
        knowledgebaseGraph={knowledgebaseGraph}
        nextAction={nextAction}
        projectId={projectId}
        sourceCounts={sourceCounts}
        sourceReady={sourceReady}
      />

      <ProjectSettings detail={detail} />

      {detail.project.status === PROJECT_STATUS.FAILED && sourceReady ? (
        <section className="rounded-[1.5rem] border border-status-danger-border bg-status-danger-surface p-5">
          <div className="space-y-1">
            <p className="font-mono text-[0.65rem] tabular-nums tracking-[0.18em] uppercase text-status-danger-foreground">
              Pipeline failure
            </p>
            <h2 className="text-lg font-medium text-status-danger-foreground">
              Last graph build failed
            </h2>
            <p className="text-sm leading-7 text-status-danger-foreground/82">
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
              <h2 className="max-w-[28ch] text-balance text-3xl leading-[1.05] font-medium tracking-[-0.03em] text-foreground md:text-4xl">
                Project status and pipeline progress.
              </h2>
              <p className="max-w-[60ch] text-pretty text-sm leading-relaxed text-muted-foreground">
                Monitor the end-to-end knowledge base generation pipeline.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-card/50 px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.18em] uppercase text-muted-foreground">
              <span className="size-1.5 rounded-full bg-brand-accent pulse-soft" />
              Stage 01 / Overview
            </span>
          </header>
          <ProjectPipelineStatus
            graphReady={graphReady}
            ingestionStatus={ingestionStatus}
            knowledgebaseGraph={knowledgebaseGraph}
            projectId={projectId}
            sourceCounts={sourceCounts}
            sourceReady={sourceReady}
          />
        </div>
      ) : null}

      {stage === 'source' ? (
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Eyebrow>Source workspace</Eyebrow>
              <h2 className="max-w-[28ch] text-balance text-3xl leading-[1.05] font-medium tracking-[-0.03em] text-foreground md:text-4xl">
                Curate the multi-source library that feeds the graph.
              </h2>
              <p className="max-w-[60ch] text-pretty text-sm leading-relaxed text-muted-foreground">
                Source edits trigger direct ingestion into the relational knowledgebase projection.
                Additional inputs (URL, PDF, video transcript) are wiring up next.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-card/50 px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.18em] uppercase text-muted-foreground">
              <span className="size-1.5 rounded-full bg-brand-accent pulse-soft" />
              Stage 02 / Source
            </span>
          </header>

          <IngestionStatusPanel status={ingestionStatus} />

          <ProjectSourcesPanel projectId={detail.project.id} sources={detail.sources} />
        </div>
      ) : null}

      {stage === 'graph' ? (
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Eyebrow>Concept graph</Eyebrow>
              <h2 className="max-w-[28ch] text-balance text-2xl leading-[1.05] font-medium tracking-[-0.03em] text-foreground md:text-3xl">
                Review extraction and refine the concept structure.
              </h2>
              <p className="max-w-[60ch] text-pretty text-sm leading-relaxed text-muted-foreground">
                The graph is built directly from source ingestion. Refine definitions and
                relationships as needed.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-card/50 px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.18em] uppercase text-muted-foreground">
              <span className="size-1.5 rounded-full bg-brand-accent pulse-soft" />
              Stage 03 / Graph
            </span>
          </header>
          <ConceptGraphWorkspace
            artifact={null}
            concepts={knowledgebaseGraph.concepts}
            projectId={detail.project.id}
            relationships={knowledgebaseGraph.relationships}
            sources={detail.sources}
          />
        </div>
      ) : null}

      {stage === 'lesson' ? (
        <PlannedStagePanel
          blockers={[
            graphReady ? 'Concept graph is ready for downstream generation.' : 'Generate the concept graph before lesson generation opens.',
            'Learning objectives and lesson block generation are not implemented yet.',
            'Per-block revision and version history UI still belong to the next slice.',
          ]}
          ctaHref={buildStageHref(projectId, graphReady ? 'graph' : 'overview')}
          ctaLabel={graphReady ? 'Review graph again' : 'Return to overview'}
          eyebrow="Lesson workspace"
          title="This stage is reserved for objective and block review."
        />
      ) : null}

      {stage === 'publish' ? (
        <PlannedStagePanel
          blockers={[
            graphReady ? 'Graph is in place.' : 'Graph must be generated before publish readiness matters.',
            'Lesson approval is not implemented yet.',
            'Learner preview and publish gate UI are still planned.',
          ]}
          ctaHref={buildStageHref(projectId, graphReady ? 'lesson' : 'graph')}
          ctaLabel={graphReady ? 'Open lesson stage' : 'Open graph stage'}
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

function getNextAction(input: {
  graphReady: boolean;
  sourceReady: boolean;
}): { copy: string; stage: StudioStage; title: string } {
  if (!input.sourceReady) {
    return {
      copy: 'Start by adding source text or markdown. The graph workspace depends on that input.',
      stage: 'source',
      title: 'Add source material',
    };
  }

  if (!input.graphReady) {
    return {
      copy: 'The source is ready. Build the first concept graph and inspect the evidence before anything else moves forward.',
      stage: 'graph',
      title: 'Generate the concept graph',
    };
  }

  return {
    copy: 'The graph exists. Refine definitions, relationships, and evidence as needed.',
    stage: 'graph',
    title: 'Review the graph',
  };
}

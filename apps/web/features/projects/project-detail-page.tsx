'use server';

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  FileText,
  GitBranch,
  History,
  Layers3,
  MoreVertical,
  Sparkles,
} from 'lucide-react';
import {
  loadProjectDetail,
  PROJECT_STATUS,
  ProjectForbiddenError,
  ProjectNotFoundError,
} from '@grasp/domain';
import { getActor } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';
import { ProjectStatusBadge } from './project-status-badge';
import { ConceptGraphWorkspace } from './concept-graph-workspace';
import { DeleteProjectForm, ProjectDetailsForm } from './project-lifecycle-forms';
import { ProjectSourcesPanel } from './source-material-form';
import { statusChipVariants } from './project-style-variants';
import {
  buildStageHref,
  resolveStage,
  STAGE_LABELS,
  type StudioStage,
} from './stages';

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
    <section className="flex w-full flex-col gap-10 text-[#f3efe3]">
      {/* Header — asymmetric, no card overuse */}
      <header className="flex flex-col gap-8">
        {/* Crumb + actions row */}
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-5">
            <Eyebrow>Project studio</Eyebrow>

            <div className="space-y-4">
              <h1 className="max-w-[20ch] text-balance text-[clamp(2.4rem,4vw,4rem)] leading-[0.96] font-medium tracking-[-0.04em] text-[#f3efe3]">
                {detail.project.title}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <ProjectStatusBadge status={detail.project.status} />
                <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.16em] uppercase text-[#f3efe3]/42">
                  id {detail.project.id.slice(0, 8)}
                </span>
              </div>
            </div>

            {detail.project.description ? (
              <p className="max-w-[60ch] text-pretty text-base leading-relaxed text-[#f3efe3]/62">
                {detail.project.description}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <button
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-[#f3efe3]/72 transition-all duration-200 hover:bg-white/[0.07] hover:text-[#f3efe3] active:scale-[0.98]"
              type="button"
            >
              <History className="size-4" strokeWidth={1.5} />
              History
            </button>
            <button
              aria-label="More options"
              className="inline-flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#f3efe3]/72 transition-all duration-200 hover:bg-white/[0.07] hover:text-[#f3efe3] active:scale-[0.98]"
              type="button"
            >
              <MoreVertical className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Status strip — compact rail, secondary to the project heading */}
        <dl className="grid gap-px overflow-hidden rounded-[1.35rem] border border-white/8 bg-white/[0.045] lg:grid-cols-[1.25fr_0.85fr_0.85fr_0.85fr]">
          <NextActionCell
            copy={nextAction.copy}
            href={buildStageHref(projectId, nextAction.stage)}
            stageLabel={STAGE_LABELS[nextAction.stage]}
            title={nextAction.title}
          />
          <StatusCell
            label="Source"
            ready={sourceReady}
            statHint={`${sourceCounts.characters} characters`}
            statValue={String(sourceCounts.words)}
            unit="words"
          />
          <StatusCell
            label="Ingestion"
            ready={ingestionStatus.ready}
            statHint={ingestionStatus.hint}
            statValue={ingestionStatus.value}
            unit={ingestionStatus.unit}
          />
            <StatusCell
              label="Graph"
              ready={graphReady}
              statHint={`${knowledgebaseGraph.relationships.length} prerequisite links`}
              statValue={String(knowledgebaseGraph.concepts.length)}
              unit="concepts"
            />
        </dl>
      </header>

      {/* Project settings — branded dark, collapsed by default */}
      <details className="group rounded-[1.75rem] border border-white/10 bg-white/[0.025] open:bg-white/[0.04]">
        <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-5 text-sm font-medium text-[#f3efe3]/82 transition-colors hover:text-[#f3efe3]">
          <span className="flex items-center gap-3">
            <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.18em] uppercase text-[#f3efe3]/42">
              §
            </span>
            <span>Project settings</span>
          </span>
          <span className="font-mono text-[0.65rem] tracking-[0.16em] uppercase text-[#f3efe3]/42 transition-colors group-open:text-[#53d1cb]">
            lifecycle
          </span>
        </summary>
        <div className="border-t border-white/8 p-6">
          <div className="mb-5 flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="font-mono text-[0.65rem] tabular-nums tracking-[0.18em] uppercase text-[#f3efe3]/42">
                Project lifecycle
              </p>
              <h2 className="text-xl font-medium tracking-tight text-[#f3efe3]">
                Project details
              </h2>
            </div>
            <DeleteProjectForm
              disabled={detail.project.status === PROJECT_STATUS.PROCESSING}
              projectId={detail.project.id}
            />
          </div>
          <ProjectDetailsForm
            description={detail.project.description}
            projectId={detail.project.id}
            title={detail.project.title}
          />
        </div>
      </details>

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
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
          {/* Left column — pipeline + graph snapshot */}
          <div className="min-w-0 space-y-12">
            {/* Pipeline snapshot — divide-y stage list */}
            <section className="space-y-6">
              <header className="flex items-end justify-between gap-4">
                <div className="space-y-2">
                  <Eyebrow>Pipeline snapshot</Eyebrow>
                  <h2 className="text-2xl leading-[1.05] font-medium tracking-[-0.03em] md:text-3xl">
                    Source to publish, one workspace.
                  </h2>
                </div>
                <Sparkles className="hidden size-5 shrink-0 text-[#53d1cb] md:block" strokeWidth={1.5} />
              </header>

              <ol className="divide-y divide-white/8 border-y border-white/8">
                <PipelineRow
                  cite="01"
                  copy="Source text is editable before any graph run."
                  icon={FileText}
                  ready={sourceReady}
                  stat={`${sourceCounts.words} words`}
                  title="Source"
                />
                <PipelineRow
                  cite="02"
                  copy="Source changes trigger direct ingestion into the knowledgebase projection."
                  icon={Sparkles}
                  ready={ingestionStatus.ready}
                  stat={ingestionStatus.value}
                  title="Ingestion"
                />
                <PipelineRow
                  cite="03"
                  copy="Graph review stays grounded with evidence and confidence."
                  icon={GitBranch}
                  ready={graphReady}
                  stat={`${knowledgebaseGraph.concepts.length} concepts`}
                  title="Graph"
                />
                <PipelineRow
                  cite="04"
                  copy="Lesson and publish layer on top of the reviewed graph."
                  icon={Layers3}
                  ready={false}
                  stat="planned"
                  title="Next slices"
                />
              </ol>
            </section>

            {/* Current graph — divide-x stat strip with open CTA */}
            <section className="space-y-6">
              <header className="flex items-end justify-between gap-4">
                <div className="space-y-2">
                  <Eyebrow>Current graph</Eyebrow>
                  <h2 className="text-2xl leading-[1.05] font-medium tracking-[-0.03em] md:text-3xl">
                    Continue the active review thread.
                  </h2>
                </div>
                <Link
                  className="group inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-medium text-[#f3efe3]/82 transition-all duration-200 hover:border-[#53d1cb]/24 hover:bg-[#53d1cb]/8 hover:text-[#53d1cb]"
                  href={buildStageHref(projectId, 'graph')}
                >
                  Open graph
                  <ArrowUpRight
                    className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    strokeWidth={1.5}
                  />
                </Link>
              </header>

              <dl className="grid gap-px overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/8 md:grid-cols-2">
                <GraphStatCell
                  label="Concepts"
                  unit="extracted"
                  value={String(knowledgebaseGraph.concepts.length)}
                />
                <GraphStatCell
                  label="Relationships"
                  unit="prerequisites"
                  value={String(knowledgebaseGraph.relationships.length)}
                />
              </dl>
            </section>
          </div>

          {/* Right column — guidance + readiness */}
          <aside className="space-y-12 xl:sticky xl:top-24 xl:self-start">
            <section className="space-y-5">
              <Eyebrow>Studio guidance</Eyebrow>
              <ol className="divide-y divide-white/8 border-y border-white/8">
                <GuidanceRow
                  cite="01"
                  copy="Maintain raw material and preview markdown before any run."
                  label="Source"
                />
                <GuidanceRow
                  cite="02"
                  copy="Generate, refine, and approve the concept structure."
                  label="Graph"
                />
                <GuidanceRow
                  cite="03"
                  copy="Lesson and publish remain visible to keep the full pipeline shape."
                  label="Downstream"
                />
              </ol>
            </section>

            <section className="space-y-5">
              <Eyebrow>Current readiness</Eyebrow>
              <ul className="space-y-2">
                <ReadinessRow label="Source saved" ready={sourceReady} />
                <ReadinessRow label="Ingestion completed" ready={ingestionStatus.ready} />
                <ReadinessRow label="Graph generated" ready={graphReady} />
                <ReadinessRow label="Lesson review" ready={false} />
                <ReadinessRow label="Publish gate" ready={false} />
              </ul>
            </section>
          </aside>
        </div>
      ) : null}

      {stage === 'source' ? (
        <div className="flex flex-col gap-8">
          {/* Stage toolbar */}
          <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Eyebrow>Source workspace</Eyebrow>
              <h2 className="max-w-[28ch] text-balance text-3xl leading-[1.05] font-medium tracking-[-0.03em] text-[#f3efe3] md:text-4xl">
                Curate the multi-source library that feeds the graph.
              </h2>
              <p className="max-w-[60ch] text-pretty text-sm leading-relaxed text-[#f3efe3]/62">
                Source edits trigger direct ingestion into the relational knowledgebase projection.
                Additional inputs (URL, PDF, video transcript) are wiring up next.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.18em] uppercase text-[#f3efe3]/72">
              <span className="size-1.5 rounded-full bg-[#53d1cb] pulse-soft" />
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
              <h2 className="max-w-[28ch] text-balance text-2xl leading-[1.05] font-medium tracking-[-0.03em] text-[#f3efe3] md:text-3xl">
                Review extraction and refine the concept structure.
              </h2>
              <p className="max-w-[60ch] text-pretty text-sm leading-relaxed text-[#f3efe3]/62">
                The graph is built directly from source ingestion. Refine definitions and
                relationships as needed.
              </p>
            </div>
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
    .map((source) => source.content?.trim() ?? '')
    .filter(Boolean)
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

function formatRelativeDate(value: Date) {
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(value);
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

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[0.7rem] tracking-[0.18em] uppercase text-[#f3efe3]/62">
      <span className="size-1.5 rounded-full bg-[#53d1cb] pulse-soft" />
      <span className="font-mono">{children}</span>
    </span>
  );
}

function NextActionCell({
  copy,
  href,
  stageLabel,
  title,
}: {
  copy: string;
  href: string;
  stageLabel: string;
  title: string;
}) {
  return (
    <Link
      className="group relative flex h-full flex-col justify-between gap-4 bg-[#0b131d]/72 p-5 transition-colors hover:bg-[#0d1824]"
      href={href}
    >
      <span
        aria-hidden
        className="absolute top-5 bottom-5 left-0 w-px rounded-full bg-[#53d1cb]/72"
      />
      <div className="space-y-2 pl-3">
        <span className="font-mono text-[0.58rem] tabular-nums tracking-[0.2em] uppercase text-[#53d1cb]/82">
          Next action
        </span>
        <h2 className="text-lg leading-[1.15] font-medium tracking-[-0.02em] text-[#f3efe3]/92">
          {title}
        </h2>
        <p className="max-w-[46ch] text-xs leading-relaxed text-[#f3efe3]/54">{copy}</p>
      </div>

      <span className="inline-flex items-center gap-2 pl-3 text-xs font-medium text-[#53d1cb]/92 transition-colors group-hover:text-[#7ceae3]">
        Open {stageLabel}
        <ArrowUpRight
          className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          strokeWidth={1.5}
        />
      </span>
    </Link>
  );
}

function StatusCell({
  label,
  ready,
  statHint,
  statValue,
  unit,
}: {
  label: string;
  ready: boolean;
  statHint: string;
  statValue: string;
  unit: string;
}) {
  return (
    <div className="flex h-full flex-col justify-between gap-4 bg-[#0b131d]/72 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[0.58rem] tabular-nums tracking-[0.2em] uppercase text-[#f3efe3]/44">
          {label}
        </span>
        <StatusChip ready={ready} />
      </div>

      <div className="space-y-1">
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-2xl font-medium tabular-nums tracking-tight text-[#f3efe3]/92">
            {statValue}
          </span>
          <span className="text-xs text-[#f3efe3]/48">{unit}</span>
        </p>
        <p className="text-xs leading-relaxed text-[#f3efe3]/48">{statHint}</p>
      </div>
    </div>
  );
}

function PipelineRow({
  cite,
  copy,
  icon: Icon,
  ready,
  stat,
  title,
}: {
  cite: string;
  copy: string;
  icon: typeof FileText;
  ready: boolean;
  stat: string;
  title: string;
}) {
  return (
    <li className="grid gap-3 py-6 md:grid-cols-[60px_1fr_auto] md:items-baseline md:gap-8">
      <span className="font-mono text-sm tabular-nums tracking-[0.16em] uppercase text-[#53d1cb]">
        {cite}
      </span>
      <div className="space-y-2">
        <h3 className="flex items-center gap-2.5 text-lg font-medium tracking-tight text-[#f3efe3]">
          <Icon className="size-4 text-[#f3efe3]/72" strokeWidth={1.5} />
          {title}
        </h3>
        <p className="max-w-[64ch] text-sm leading-relaxed text-[#f3efe3]/62">{copy}</p>
        <p className="font-mono text-[0.7rem] tabular-nums tracking-[0.14em] uppercase text-[#f3efe3]/52">
          {stat}
        </p>
      </div>
      <div className="md:text-right">
        <StatusChip ready={ready} />
      </div>
    </li>
  );
}

function GraphStatCell({
  accent = false,
  label,
  unit,
  value,
}: {
  accent?: boolean;
  label: string;
  unit: string;
  value: string;
}) {
  return (
    <div className="flex h-full flex-col justify-between gap-4 bg-[#0d1824] p-6">
      <p className="font-mono text-[0.65rem] tabular-nums tracking-[0.18em] uppercase text-[#f3efe3]/52">
        {label}
      </p>
      <div className="space-y-1">
        <p
          className={`text-2xl leading-tight font-medium tracking-tight capitalize ${
            accent ? 'text-[#53d1cb]' : 'text-[#f3efe3]'
          }`}
        >
          {value}
        </p>
        <p className="font-mono text-[0.65rem] tabular-nums tracking-[0.14em] uppercase text-[#f3efe3]/42">
          {unit}
        </p>
      </div>
    </div>
  );
}

function GuidanceRow({ cite, copy, label }: { cite: string; copy: string; label: string }) {
  return (
    <li className="grid gap-2 py-4 md:grid-cols-[40px_1fr] md:items-baseline md:gap-5">
      <span className="font-mono text-[0.7rem] tabular-nums tracking-[0.18em] uppercase text-[#53d1cb]">
        {cite}
      </span>
      <div className="space-y-1.5">
        <h3 className="text-sm font-medium tracking-tight text-[#f3efe3]">{label}</h3>
        <p className="max-w-[44ch] text-sm leading-relaxed text-[#f3efe3]/62">{copy}</p>
      </div>
    </li>
  );
}

function StatusChip({ ready }: { ready: boolean }) {
  return (
    <span className={statusChipVariants({ ready })}>
      {ready ? <CheckCircle2 className="size-3.5" /> : <CircleDashed className="size-3.5" />}
      {ready ? 'Ready' : 'Pending'}
    </span>
  );
}

function IngestionStatusPanel({
  status,
}: {
  status: ReturnType<typeof getIngestionStatus>;
}) {
  return (
    <section className="grid gap-px overflow-hidden rounded-[1.35rem] border border-white/8 bg-white/[0.045] md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="flex items-center justify-between gap-4 bg-[#0b131d]/72 p-5">
        <div className="space-y-1">
          <p className="font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase text-[#f3efe3]/44">
            Ingestion
          </p>
          <p className="text-lg font-medium tracking-tight text-[#f3efe3] capitalize">
            {status.value}
          </p>
        </div>
        <StatusChip ready={status.ready} />
      </div>
      <div className="bg-[#0b131d]/72 p-5">
        <p className="text-sm leading-7 text-[#f3efe3]/68">{status.hint}</p>
        <p className="mt-2 font-mono text-[0.65rem] tracking-[0.16em] uppercase text-[#f3efe3]/42">
          Direct source ingestion / vector search later
        </p>
      </div>
    </section>
  );
}

function ReadinessRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-[1.15rem] border border-white/10 bg-white/[0.025] px-4 py-3">
      <span className="text-sm text-[#f3efe3]/82">{label}</span>
      <StatusChip ready={ready} />
    </li>
  );
}

function PlannedStagePanel({
  blockers,
  ctaHref,
  ctaLabel,
  eyebrow,
  title,
}: {
  blockers: string[];
  ctaHref: string;
  ctaLabel: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
        <p className="text-sm font-medium text-white/68">{eyebrow}</p>
        <h2 className="mt-2 max-w-3xl text-3xl leading-tight font-medium tracking-[-0.04em] text-white">
          {title}
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#f3efe3]/72">
          This placeholder keeps the project studio aligned with the end-to-end MVP architecture
          while the current implementation stays focused on source and graph review.
        </p>
        <div className="mt-6 space-y-3">
          {blockers.map((blocker) => (
            <div
              className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-7 text-white/74"
              key={blocker}
            >
              {blocker}
            </div>
          ))}
        </div>
      </article>

      <aside className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-sm font-medium text-white/68">Suggested route</p>
        <p className="mt-3 text-sm leading-7 text-[#f3efe3]/72">
          Return to the currently implemented stage and keep the workflow moving there.
        </p>
        <Link
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/74 transition-all duration-200 hover:bg-white/[0.07] hover:text-white"
          href={ctaHref}
        >
          {ctaLabel}
          <ArrowRight className="size-4" />
        </Link>
      </aside>
    </section>
  );
}

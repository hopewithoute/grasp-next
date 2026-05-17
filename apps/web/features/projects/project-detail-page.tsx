'use server';

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  FileBadge,
  FileText,
  GitBranch,
  History,
  Layers3,
  Link2,
  MoreVertical,
  Plus,
  Sparkles,
  Video,
} from 'lucide-react';
import {
  loadProjectDetail,
  PROJECT_STATUS,
  ProjectForbiddenError,
  ProjectNotFoundError,
} from '@grasp/domain';
import { getActor } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';
import { ApproveArtifactForm } from './approve-artifact-form';
import { ProjectStatusBadge } from './project-status-badge';
import { ConceptGraphWorkspace } from './concept-graph-workspace';
import { DeleteProjectForm, ProjectDetailsForm } from './project-lifecycle-forms';
import { SourceMaterialForm } from './source-material-form';
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
        artifactRepository: deps.artifactRepository,
        conceptRepository: deps.conceptRepository,
        projectRepository: deps.projectRepository,
      }
    );
  } catch (error) {
    if (error instanceof ProjectNotFoundError || error instanceof ProjectForbiddenError) {
      notFound();
    }

    throw error;
  }

  const canApprove =
    detail.conceptGraphArtifact?.status === 'generated' ||
    detail.conceptGraphArtifact?.status === 'needs_revision';
  const stage = resolveStage(currentStage);
  const sourceReady = Boolean(detail.project.sourceMaterial?.trim());
  const graphReady = detail.concepts.length > 0;
  const graphApproved = detail.conceptGraphArtifact?.status === 'approved';
  const sourceCounts = getSourceCounts(detail.project.sourceMaterial);
  const nextAction = getNextAction({
    graphApproved,
    graphReady,
    sourceReady,
  });
  const artifactStatusLabel =
    detail.conceptGraphArtifact?.status.replace('_', ' ') ?? 'not generated';

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
        <dl className="grid gap-px overflow-hidden rounded-[1.35rem] border border-white/8 bg-white/[0.045] lg:grid-cols-[1.25fr_0.85fr_0.85fr]">
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
            label="Graph"
            ready={graphReady}
            statHint={`${detail.relationships.length} prerequisite links`}
            statValue={String(detail.concepts.length)}
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

      {detail.project.status === PROJECT_STATUS.FAILED && detail.project.sourceMaterial ? (
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
                  copy="Graph review stays grounded with evidence and confidence."
                  icon={GitBranch}
                  ready={graphReady}
                  stat={`${detail.concepts.length} concepts`}
                  title="Graph"
                />
                <PipelineRow
                  cite="03"
                  copy="Lesson and publish layer on top of the approved graph."
                  icon={Layers3}
                  ready={graphApproved}
                  stat={graphApproved ? 'graph approved' : 'pending approval'}
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

              <dl className="grid gap-px overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/8 md:grid-cols-3">
                <GraphStatCell
                  label="Artifact"
                  unit="status"
                  value={artifactStatusLabel}
                />
                <GraphStatCell
                  label="Relationships"
                  unit="prerequisites"
                  value={String(detail.relationships.length)}
                />
                <GraphStatCell
                  accent={graphApproved}
                  label="Approval"
                  unit={graphApproved ? 'cleared' : 'pending'}
                  value={graphApproved ? 'ready' : 'review'}
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
                <ReadinessRow label="Graph generated" ready={graphReady} />
                <ReadinessRow label="Graph approved" ready={graphApproved} />
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
                Concepts and evidence are extracted from the sources below. Today the studio reads a
                primary text source — additional inputs (URL, PDF, video transcript) are wiring up
                next.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.18em] uppercase text-[#f3efe3]/72">
              <span className="size-1.5 rounded-full bg-[#53d1cb] pulse-soft" />
              Stage 02 / Source
            </span>
          </header>

          <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_18rem]">
            {/* Left rail — sources list */}
            <aside className="min-w-0 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <Eyebrow>Sources</Eyebrow>
                <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.16em] uppercase text-[#f3efe3]/42">
                  01 / 01
                </span>
              </div>
              <ul className="space-y-2">
                <li>
                  <SourceListItem
                    active
                    characters={sourceCounts.characters}
                    hint={getSourcePreview(detail.project.sourceMaterial)}
                    index="01"
                    kind="text"
                    label="Primary text source"
                    ready={sourceReady}
                    words={sourceCounts.words}
                  />
                </li>
                <li>
                  <AddSourceCard />
                </li>
              </ul>
            </aside>

            {/* Editor */}
            <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.025] p-6">
              <div className="mb-5 flex flex-col gap-3 border-b border-white/8 pb-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.18em] uppercase text-[#53d1cb]">
                    source 01 · text
                  </span>
                  <h3 className="text-xl font-medium tracking-tight text-[#f3efe3]">
                    Primary text source
                  </h3>
                  <p className="max-w-[52ch] text-sm leading-relaxed text-[#f3efe3]/62">
                    The graph agent reads this body verbatim. Keep terminology consistent and remove
                    boilerplate before the first run.
                  </p>
                </div>
                <span className={statusChipVariants({ ready: sourceReady })}>
                  {sourceReady ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <CircleDashed className="size-3.5" />
                  )}
                  {sourceReady ? 'Saved' : 'Empty'}
                </span>
              </div>
              <div className="rounded-[1.35rem] border border-white/10 bg-[#0d1824]/72 p-5 text-[#f3efe3] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <SourceMaterialForm
                  projectId={detail.project.id}
                  sourceMaterial={detail.project.sourceMaterial}
                />
              </div>
            </section>

            {/* Right rail — health + next step */}
            <aside className="min-w-0 space-y-6">
              <section className="space-y-4">
                <Eyebrow>Source health</Eyebrow>
                <dl className="grid gap-px overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/8">
                  <SourceStatRow
                    label="Words"
                    unit="primary"
                    value={String(sourceCounts.words)}
                  />
                  <SourceStatRow
                    label="Characters"
                    unit="primary"
                    value={String(sourceCounts.characters)}
                  />
                  <SourceStatRow label="Sources" unit="connected" value="1" />
                </dl>
              </section>

              <section className="space-y-3 rounded-[1.35rem] border border-white/10 bg-white/[0.025] p-5">
                <Eyebrow>Next step</Eyebrow>
                <p className="text-sm leading-relaxed text-[#f3efe3]/72">
                  Once the source is saved and stable, run the concept graph to extract concepts,
                  evidence, and prerequisite links.
                </p>
                <Link
                  className="group inline-flex w-full items-center justify-between gap-2 rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-[#f3efe3]/82 transition-all duration-200 hover:border-[#53d1cb]/24 hover:bg-[#53d1cb]/8 hover:text-[#53d1cb]"
                  href={buildStageHref(projectId, 'graph')}
                >
                  Open graph workspace
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </section>
            </aside>
          </div>
        </div>
      ) : null}

      {stage === 'graph' ? (
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Eyebrow>Concept graph</Eyebrow>
              <h2 className="max-w-[28ch] text-balance text-2xl leading-[1.05] font-medium tracking-[-0.03em] text-[#f3efe3] md:text-3xl">
                Review extraction, refine, and approve when the graph reads cleanly.
              </h2>
              <p className="max-w-[60ch] text-pretty text-sm leading-relaxed text-[#f3efe3]/62">
                Approval locks the current artifact version. Status:{' '}
                <span className="text-[#f3efe3]/82 capitalize">{artifactStatusLabel}</span>.
              </p>
            </div>
            {detail.conceptGraphArtifact ? (
              <ApproveArtifactForm
                artifactId={detail.conceptGraphArtifact.id}
                disabled={!canApprove}
              />
            ) : null}
          </header>
          <ConceptGraphWorkspace
            artifact={detail.conceptGraphArtifact}
            concepts={detail.concepts}
            projectId={detail.project.id}
            relationships={detail.relationships}
            sourceMaterial={detail.project.sourceMaterial}
          />
        </div>
      ) : null}

      {stage === 'lesson' ? (
        <PlannedStagePanel
          blockers={[
            graphApproved ? 'Approved concept graph is ready for downstream generation.' : 'Approve the concept graph before lesson generation opens.',
            'Learning objectives and lesson block generation are not implemented yet.',
            'Per-block revision and version history UI still belong to the next slice.',
          ]}
          ctaHref={buildStageHref(projectId, graphApproved ? 'graph' : 'overview')}
          ctaLabel={graphApproved ? 'Review graph again' : 'Return to overview'}
          eyebrow="Lesson workspace"
          title="This stage is reserved for objective and block review."
        />
      ) : null}

      {stage === 'publish' ? (
        <PlannedStagePanel
          blockers={[
            graphApproved ? 'Graph approval is in place.' : 'Graph approval must happen before publish readiness matters.',
            'Lesson approval is not implemented yet.',
            'Learner preview and publish gate UI are still planned.',
          ]}
          ctaHref={buildStageHref(projectId, graphApproved ? 'lesson' : 'graph')}
          ctaLabel={graphApproved ? 'Open lesson stage' : 'Open graph stage'}
          eyebrow="Publish gate"
          title="Publish stays visible so the studio keeps the full end-to-end shape."
        />
      ) : null}
    </section>
  );
}

function getSourceCounts(sourceMaterial: string | null) {
  const value = sourceMaterial?.trim() ?? '';

  return {
    characters: value.length,
    words: value ? value.split(/\s+/).length : 0,
  };
}

function getNextAction(input: {
  graphApproved: boolean;
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

  if (!input.graphApproved) {
    return {
      copy: 'The graph exists, but it still needs review. Refine definitions, relationships, and evidence before approval.',
      stage: 'graph',
      title: 'Approve the graph',
    };
  }

  return {
    copy: 'The approved graph is ready for the lesson slice once objective and block review ship.',
    stage: 'lesson',
    title: 'Prepare lesson review',
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

type SourceKind = 'pdf' | 'text' | 'url' | 'video';

const SOURCE_KIND_ICON: Record<SourceKind, typeof FileText> = {
  pdf: FileBadge,
  text: FileText,
  url: Link2,
  video: Video,
};

function getSourcePreview(value: string | null): string {
  const trimmed = value?.trim() ?? '';

  if (!trimmed) {
    return 'No content yet — paste markdown or notes to get started.';
  }

  return trimmed.length > 90 ? `${trimmed.slice(0, 90)}…` : trimmed;
}

function SourceListItem({
  active,
  characters,
  hint,
  index,
  kind,
  label,
  ready,
  words,
}: {
  active: boolean;
  characters: number;
  hint: string;
  index: string;
  kind: SourceKind;
  label: string;
  ready: boolean;
  words: number;
}) {
  const Icon = SOURCE_KIND_ICON[kind];
  const containerClass = active
    ? 'border-white/12 bg-[#0d1824]'
    : 'border-white/8 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.04]';
  const statusClass = ready
    ? 'border-status-success-border bg-status-success-surface text-status-success-foreground'
    : 'border-status-neutral-border bg-status-neutral-surface text-status-neutral-foreground';

  return (
    <article
      className={`group relative overflow-hidden rounded-[1.25rem] border px-4 py-4 transition-all duration-200 ${containerClass}`}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute top-4 bottom-4 left-0 w-[2px] rounded-full bg-[#53d1cb]"
        />
      ) : null}
      <div className="space-y-3 pl-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 font-mono text-[0.6rem] tabular-nums tracking-[0.18em] uppercase text-[#53d1cb]">
            {index}
            <span className="text-[#f3efe3]/42">·</span>
            <span className="text-[#f3efe3]/62">{kind}</span>
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6rem] font-medium tracking-[0.14em] uppercase ${statusClass}`}
          >
            {ready ? 'Active' : 'Empty'}
          </span>
        </div>
        <div className="space-y-1.5">
          <h3 className="flex items-center gap-2 text-sm font-medium tracking-tight text-[#f3efe3]">
            <Icon className="size-3.5 text-[#f3efe3]/72" strokeWidth={1.5} />
            {label}
          </h3>
          <p className="line-clamp-2 text-xs leading-relaxed text-[#f3efe3]/52">{hint}</p>
        </div>
        <p className="font-mono text-[0.6rem] tabular-nums tracking-[0.14em] uppercase text-[#f3efe3]/42">
          {words} words · {characters} chars
        </p>
      </div>
    </article>
  );
}

function AddSourceCard() {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-white/12 bg-white/[0.015] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-sm font-medium text-[#f3efe3]/72">
            <Plus className="size-3.5" strokeWidth={1.5} />
            Add source
          </p>
          <p className="font-mono text-[0.6rem] tabular-nums tracking-[0.14em] uppercase text-[#f3efe3]/42">
            multi-source · soon
          </p>
        </div>
        <span className="font-mono text-[0.6rem] tabular-nums tracking-[0.18em] uppercase text-[#53d1cb]/72">
          02 +
        </span>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2 text-[0.65rem] tracking-wide text-[#f3efe3]/52">
        <li className="flex items-center gap-2">
          <Link2 className="size-3" strokeWidth={1.5} />
          URL · web
        </li>
        <li className="flex items-center gap-2">
          <FileBadge className="size-3" strokeWidth={1.5} />
          PDF · doc
        </li>
        <li className="flex items-center gap-2">
          <Video className="size-3" strokeWidth={1.5} />
          Video · transcript
        </li>
        <li className="flex items-center gap-2">
          <FileText className="size-3" strokeWidth={1.5} />
          Markdown · notes
        </li>
      </ul>
    </div>
  );
}

function SourceStatRow({ label, unit, value }: { label: string; unit: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-[#0d1824] px-4 py-3">
      <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.16em] uppercase text-[#f3efe3]/52">
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-base font-medium tabular-nums tracking-tight text-[#f3efe3]">
          {value}
        </span>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[#f3efe3]/42">
          {unit}
        </span>
      </div>
    </div>
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

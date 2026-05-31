import Link from 'next/link';
import { ArrowUpRight, FileText, GitBranch, Layers3, Sparkles } from 'lucide-react';
import { buildStageHref } from '../stages';
import { Eyebrow, StatusChip } from './project-shared';

type ProjectPipelineStatusProps = {
  graphReady: boolean;
  ingestionStatus: {
    hint: string;
    ready: boolean;
    unit: string;
    value: string;
  };
  knowledgebaseGraph: {
    concepts: unknown[];
    relationships: unknown[];
  };
  projectId: string;
  sourceCounts: {
    characters: number;
    words: number;
  };
  sourceReady: boolean;
};

export function ProjectPipelineStatus({
  graphReady,
  ingestionStatus,
  knowledgebaseGraph,
  projectId,
  sourceCounts,
  sourceReady,
}: ProjectPipelineStatusProps) {
  return (
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
            <Sparkles
              className="hidden size-5 shrink-0 text-brand-accent md:block"
              strokeWidth={1.5}
            />
          </header>

          <ol className="divide-y divide-border border-y border-border">
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
              copy="Source changes trigger ingestion to build the concept graph workspace."
              icon={GitBranch}
              ready={ingestionStatus.ready}
              stat={
                ingestionStatus.ready
                  ? `${knowledgebaseGraph.concepts.length} concepts`
                  : ingestionStatus.value
              }
              title="Workspace"
            />
            <PipelineRow
              cite="03"
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
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-brand-accent-border hover:bg-brand-accent-surface hover:text-brand-accent-foreground"
              href={buildStageHref(projectId, 'workspace')}
            >
              Open workspace
              <ArrowUpRight
                className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                strokeWidth={1.5}
              />
            </Link>
          </header>

          <dl className="grid gap-px overflow-hidden rounded-[1.75rem] border border-border bg-card/50 md:grid-cols-2">
            <GraphStatCell
              label="Concepts"
              unit="extracted"
              value={String(knowledgebaseGraph.concepts.length)}
            />
            <GraphStatCell
              label="Relationships"
              unit="relationships"
              value={String(knowledgebaseGraph.relationships.length)}
            />
          </dl>
        </section>
      </div>

      {/* Right column — guidance + readiness */}
      <aside className="space-y-12 xl:sticky xl:top-24 xl:self-start">
        <section className="space-y-5">
          <Eyebrow>Studio guidance</Eyebrow>
          <ol className="divide-y divide-border border-y border-border">
            <GuidanceRow
              cite="01"
              copy="Maintain raw material and preview markdown before any run."
              label="Source"
            />
            <GuidanceRow
              cite="02"
              copy="Ingest sources and refine the concept structure."
              label="Workspace"
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
            <ReadinessRow label="Workspace synced" ready={ingestionStatus.ready && graphReady} />
            <ReadinessRow label="Lesson review" ready={false} />
            <ReadinessRow label="Publish gate" ready={false} />
          </ul>
        </section>
      </aside>
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
      <span className="font-mono text-sm tabular-nums tracking-[0.16em] uppercase text-brand-accent-foreground">
        {cite}
      </span>
      <div className="space-y-2">
        <h3 className="flex items-center gap-2.5 text-lg font-medium tracking-tight text-foreground">
          <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} />
          {title}
        </h3>
        <p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">{copy}</p>
        <p className="font-mono text-[0.7rem] tabular-nums tracking-[0.14em] uppercase text-muted-foreground">
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
    <div className="flex h-full flex-col justify-between gap-4 bg-card p-6">
      <p className="font-mono text-[0.65rem] tabular-nums tracking-[0.18em] uppercase text-muted-foreground">
        {label}
      </p>
      <div className="space-y-1">
        <p
          className={`text-2xl leading-tight font-medium tracking-tight capitalize ${
            accent ? 'text-brand-accent-foreground' : 'text-foreground'
          }`}
        >
          {value}
        </p>
        <p className="font-mono text-[0.65rem] tabular-nums tracking-[0.14em] uppercase text-muted-foreground">
          {unit}
        </p>
      </div>
    </div>
  );
}

function GuidanceRow({ cite, copy, label }: { cite: string; copy: string; label: string }) {
  return (
    <li className="grid gap-2 py-4 md:grid-cols-[40px_1fr] md:items-baseline md:gap-5">
      <span className="font-mono text-[0.7rem] tabular-nums tracking-[0.18em] uppercase text-brand-accent-foreground">
        {cite}
      </span>
      <div className="space-y-1.5">
        <h3 className="text-sm font-medium tracking-tight text-foreground">{label}</h3>
        <p className="max-w-[44ch] text-sm leading-relaxed text-muted-foreground">{copy}</p>
      </div>
    </li>
  );
}

function ReadinessRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-[1.15rem] border border-border bg-card/50 px-4 py-3">
      <span className="text-sm text-foreground">{label}</span>
      <StatusChip ready={ready} />
    </li>
  );
}

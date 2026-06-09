import Link from 'next/link';
import { ArrowUpRight, FileText, GitBranch, Layers3, Sparkles } from 'lucide-react';
import { buildStageHref } from '../stages';
import { StatusChip } from './project-shared';

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
      <div className="min-w-0 space-y-16">
        {/* Pipeline snapshot — sharp grid list */}
        <section className="space-y-6">
          <header className="border-border/40 flex items-end justify-between gap-4 border-b pb-4">
            <div className="space-y-2">
              <span className="text-brand-accent/80 font-mono text-[0.65rem] tracking-[0.3em] uppercase">
                [ SYS.PIPELINE ]
              </span>
              <h2 className="text-2xl leading-[1.05] font-light tracking-[-0.03em] uppercase md:text-3xl">
                [ END_TO_END_EXTRACTION ]
              </h2>
            </div>
            <Sparkles
              className="text-brand-accent animate-pulse-soft hidden size-5 shrink-0 md:block"
              strokeWidth={1}
            />
          </header>

          <ol className="divide-border border-border/40 divide-y border-y">
            <PipelineRow
              cite="01"
              copy="> Source text is editable before graph initialization."
              icon={FileText}
              ready={sourceReady}
              stat={`${sourceCounts.words} words`}
              title="[ SOURCE ]"
            />
            <PipelineRow
              cite="02"
              copy="> Changes trigger ingestion to map the concept structure."
              icon={GitBranch}
              ready={ingestionStatus.ready}
              stat={
                ingestionStatus.ready
                  ? `${knowledgebaseGraph.concepts.length} concepts`
                  : ingestionStatus.value
              }
              title="[ WORKSPACE ]"
            />
            <PipelineRow
              cite="03"
              copy="> Final outputs layer onto the verified graph."
              icon={Layers3}
              ready={false}
              stat="[ STANDBY ]"
              title="[ NEXT_SLICES ]"
            />
          </ol>
        </section>

        {/* Current graph — sharp stats with CTA */}
        <section className="space-y-6">
          <header className="border-border/40 flex items-end justify-between gap-4 border-b pb-4">
            <div className="space-y-2">
              <span className="text-brand-accent/80 font-mono text-[0.65rem] tracking-[0.3em] uppercase">
                [ SYS.GRAPH ]
              </span>
              <h2 className="text-2xl leading-[1.05] font-light tracking-[-0.03em] uppercase md:text-3xl">
                [ ACTIVE_NODE_REVIEW ]
              </h2>
            </div>
            <Link
              className="group border-border/50 bg-background hover:bg-muted/10 text-muted-foreground hover:text-foreground hover:border-brand-accent inline-flex items-center gap-3 border px-5 py-2.5 font-mono text-xs tracking-widest uppercase transition-all duration-300"
              href={buildStageHref(projectId, 'workspace')}
            >
              <span className="text-brand-accent font-bold group-hover:animate-pulse">[ </span>
              OPEN_WORKSPACE
              <span className="text-brand-accent font-bold group-hover:animate-pulse"> ]</span>
              <ArrowUpRight
                className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={1}
              />
            </Link>
          </header>

          <dl className="bg-border/40 border-border/40 grid gap-px border md:grid-cols-2">
            <div className="bg-background">
              <GraphStatCell
                label="Concepts"
                unit="extracted"
                value={String(knowledgebaseGraph.concepts.length)}
              />
            </div>
            <div className="bg-background">
              <GraphStatCell
                label="Relationships"
                unit="relationships"
                value={String(knowledgebaseGraph.relationships.length)}
              />
            </div>
          </dl>
        </section>
      </div>

      {/* Right column — guidance + readiness */}
      <aside className="border-border/40 space-y-12 border-l pl-0 xl:sticky xl:top-24 xl:self-start xl:pl-10">
        <section className="space-y-5">
          <span className="text-brand-accent/80 font-mono text-[0.65rem] tracking-[0.3em] uppercase">
            [ SYS.GUIDE ]
          </span>
          <ol className="divide-border border-border/40 divide-y border-y">
            <GuidanceRow
              cite="SEQ:01"
              copy="> Maintain raw material and check output logs."
              label="[ SOURCE ]"
            />
            <GuidanceRow
              cite="SEQ:02"
              copy="> Ingest and review graph nodes."
              label="[ WORKSPACE ]"
            />
            <GuidanceRow
              cite="SEQ:03"
              copy="> Downstream components stand by."
              label="[ PUBLISH ]"
            />
          </ol>
        </section>

        <section className="space-y-5">
          <span className="text-brand-accent/80 font-mono text-[0.65rem] tracking-[0.3em] uppercase">
            [ STATUS.CHECK ]
          </span>
          <ul className="bg-border/40 border-border/40 space-y-px border">
            <ReadinessRow label="[ SOURCE_PAYLOAD ]" ready={sourceReady} />
            <ReadinessRow label="[ GRAPH_SYNC ]" ready={ingestionStatus.ready && graphReady} />
            <ReadinessRow label="[ LESSON_REVIEW ]" ready={false} />
            <ReadinessRow label="[ PUBLISH_GATE ]" ready={false} />
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
    <li className="group grid gap-3 py-6 md:grid-cols-[60px_1fr_auto] md:items-baseline md:gap-8">
      <span className="text-brand-accent/70 font-mono text-sm tracking-[0.2em] uppercase">
        [{cite}]
      </span>
      <div className="space-y-3">
        <h3 className="text-foreground flex items-center gap-3 text-lg font-light tracking-tight uppercase">
          <Icon
            className="text-brand-accent/50 group-hover:text-brand-accent size-4 transition-colors"
            strokeWidth={1}
          />
          {title}
        </h3>
        <p className="text-muted-foreground/70 max-w-[64ch] font-mono text-xs leading-relaxed">
          {copy}
        </p>
        <p className="text-brand-accent/50 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
          {stat}
        </p>
      </div>
      <div className="mt-2 md:mt-0 md:text-right">
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
    <div className="bg-background group relative flex h-full flex-col justify-between gap-6 p-6">
      {/* Corner Accents */}
      <div className="border-muted-foreground/30 group-hover:border-brand-accent absolute top-0 left-0 size-1.5 border-t border-l transition-colors" />
      <div className="border-muted-foreground/30 group-hover:border-brand-accent absolute right-0 bottom-0 size-1.5 border-r border-b transition-colors" />

      <p className="text-muted-foreground/60 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
        {label}
      </p>
      <div className="space-y-2">
        <p
          className={`font-mono text-3xl font-light tracking-tighter uppercase ${
            accent
              ? 'text-brand-accent drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]'
              : 'text-foreground'
          }`}
        >
          {value}
        </p>
        <p className="text-brand-accent/70 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
          {unit}
        </p>
      </div>
    </div>
  );
}

function GuidanceRow({ cite, copy, label }: { cite: string; copy: string; label: string }) {
  return (
    <li className="grid gap-2 py-5 md:grid-cols-[60px_1fr] md:items-baseline md:gap-5">
      <span className="text-brand-accent/70 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
        {cite}
      </span>
      <div className="space-y-2">
        <h3 className="text-foreground font-mono text-xs tracking-widest uppercase">{label}</h3>
        <p className="text-muted-foreground/70 max-w-[44ch] font-mono text-xs leading-relaxed">
          {copy}
        </p>
      </div>
    </li>
  );
}

function ReadinessRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <li className="bg-background group flex items-center justify-between gap-4 p-4">
      <span className="text-foreground/80 font-mono text-xs tracking-widest uppercase">
        {label}
      </span>
      <StatusChip ready={ready} />
    </li>
  );
}

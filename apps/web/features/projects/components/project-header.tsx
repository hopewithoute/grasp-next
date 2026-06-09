import { StatusCell } from './project-shared';
import { ProjectStatusBadge } from './project-status-badge';

type ProjectHeaderProps = {
  detail: {
    project: {
      description: string | null;
      id: string;
      status: string;
      title: string;
    };
  };
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
  sourceCounts: {
    characters: number;
    words: number;
  };
  sourceReady: boolean;
};

export function ProjectHeader({
  detail,
  graphReady,
  ingestionStatus,
  knowledgebaseGraph,
  sourceCounts,
  sourceReady,
}: ProjectHeaderProps) {
  return (
    <header className="flex flex-col gap-5">
      {/* Crumb + actions row */}
      <div className="border-border/40 relative flex flex-col gap-6 border-b pb-8 xl:flex-row xl:items-start xl:justify-between">
        <div className="from-brand-accent/80 absolute -bottom-[0.5px] left-0 h-[1px] w-1/4 bg-gradient-to-r to-transparent" />

        <div className="min-w-0 space-y-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <ProjectStatusBadge status={detail.project.status as any} />
              <span className="text-brand-accent/70 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
                SEQ_ID: {detail.project.id.slice(0, 8)}
              </span>
            </div>
            <h1 className="text-foreground flex max-w-[30ch] items-center gap-4 text-3xl font-light tracking-[-0.02em] uppercase lg:text-4xl">
              <span className="text-brand-accent/50 font-mono font-light">[</span>
              {detail.project.title}
              <span className="text-brand-accent/50 font-mono font-light">]</span>
            </h1>
          </div>

          <p className="text-muted-foreground/80 max-w-[60ch] font-mono text-sm leading-relaxed">
            {detail.project.description ?? '> No description parameter provided.'}
          </p>
        </div>
      </div>

      {/* Status strip — compact rail, secondary to the project heading */}
      {/* Status strip — Terminal Grid */}
      <dl className="bg-border/40 border-border/40 grid gap-px border lg:grid-cols-3">
        <div className="bg-background">
          <StatusCell
            label="[ SOURCE ]"
            ready={sourceReady}
            statHint={`${sourceCounts.characters} characters`}
            statValue={String(sourceCounts.words)}
            unit="words"
          />
        </div>
        <div className="bg-background">
          <StatusCell
            label="[ INGESTION ]"
            ready={ingestionStatus.ready}
            statHint={ingestionStatus.hint}
            statValue={ingestionStatus.value}
            unit={ingestionStatus.unit}
          />
        </div>
        <div className="bg-background">
          <StatusCell
            label="[ GRAPH ]"
            ready={graphReady}
            statHint={`${knowledgebaseGraph.relationships.length} links`}
            statValue={String(knowledgebaseGraph.concepts.length)}
            unit="concepts"
          />
        </div>
      </dl>
    </header>
  );
}

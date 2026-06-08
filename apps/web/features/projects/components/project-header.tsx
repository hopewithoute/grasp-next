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
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="space-y-2">
            <h1 className="text-foreground max-w-[30ch] text-2xl font-semibold tracking-tight text-balance lg:text-3xl">
              {detail.project.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <ProjectStatusBadge status={detail.project.status as any} />
              <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.16em] uppercase tabular-nums">
                id {detail.project.id.slice(0, 8)}
              </span>
            </div>
          </div>

          {detail.project.description ? (
            <p className="text-muted-foreground max-w-[60ch] text-base leading-relaxed text-pretty">
              {detail.project.description}
            </p>
          ) : null}
        </div>
      </div>

      {/* Status strip — compact rail, secondary to the project heading */}
      <dl className="border-border bg-card/50 grid gap-px overflow-hidden rounded-[1.35rem] border lg:grid-cols-3">
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
          statHint={`${knowledgebaseGraph.relationships.length} relationship links`}
          statValue={String(knowledgebaseGraph.concepts.length)}
          unit="concepts"
        />
      </dl>
    </header>
  );
}

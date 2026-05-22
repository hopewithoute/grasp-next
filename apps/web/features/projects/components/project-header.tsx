
import { ProjectStatusBadge } from '../project-status-badge';
import { buildStageHref, STAGE_LABELS, type StudioStage } from '../stages';
import { Eyebrow, NextActionCell, StatusCell } from './project-shared';

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
    concepts: any[];
    relationships: any[];
  };
  nextAction: {
    copy: string;
    stage: StudioStage;
    title: string;
  };
  projectId: string;
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
  nextAction,
  projectId,
  sourceCounts,
  sourceReady,
}: ProjectHeaderProps) {
  return (
    <header className="flex flex-col gap-5">
      {/* Crumb + actions row */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="space-y-2">
            <h1 className="max-w-[30ch] text-balance text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
              {detail.project.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <ProjectStatusBadge status={detail.project.status as any} />
              <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.16em] uppercase text-muted-foreground">
                id {detail.project.id.slice(0, 8)}
              </span>
            </div>
          </div>

          {detail.project.description ? (
            <p className="max-w-[60ch] text-pretty text-base leading-relaxed text-muted-foreground">
              {detail.project.description}
            </p>
          ) : null}
        </div>


      </div>

      {/* Status strip — compact rail, secondary to the project heading */}
      <dl className="grid gap-px overflow-hidden rounded-[1.35rem] border border-border bg-card/50 lg:grid-cols-3">
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

'use client';

import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  useReactFlow,
} from '@xyflow/react';
import { Expand, Filter, LayoutGrid, Minus, Plus, Search, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { artifactStatusVariant, conceptDifficultyVariants } from './project-style-variants';

export type ConceptRow = {
  confidence: string;
  definition: string;
  difficulty: 'advanced' | 'beginner' | 'intermediate';
  id: string;
  name: string;
  sourceEvidence: unknown;
};

export type RelationshipRow = {
  id: string;
  metadata?: unknown;
  relationshipType: string;
  sourceEvidence?: unknown;
  sourceConceptId: string;
  targetConceptId: string;
};

export type ConceptGraphArtifact = {
  id: string;
  status: string;
} | null;

type ConceptGraphReviewProps = {
  artifact: ConceptGraphArtifact;
  concepts: ConceptRow[];
  relationships: RelationshipRow[];
};

type ConceptNodeData = {
  confidence: string;
  difficulty: ConceptRow['difficulty'];
  label: string;
};

const nodeTypes = {
  concept: ConceptNode,
};

export function ConceptGraphView({ artifact, concepts, relationships }: ConceptGraphReviewProps) {
  const { resolvedTheme } = useTheme();
  const [selectedConceptId, setSelectedConceptId] = useState(concepts[0]?.id ?? null);
  const selectedConcept =
    concepts.find((concept) => concept.id === selectedConceptId) ?? concepts[0] ?? null;
  const conceptNameById = new Map(concepts.map((concept) => [concept.id, concept.name]));
  const graph = useMemo(
    () => buildConceptGraph(concepts, relationships),
    [concepts, relationships]
  );
  const hasGraph = concepts.length > 0 && relationships.length > 0;

  return (
    <section className="space-y-5">
      {!concepts.length ? (
        <div className="rounded-[1.5rem] border border-dashed border-border bg-card px-4 py-8 text-sm text-muted-foreground">
          No concept graph has been generated yet.
        </div>
      ) : hasGraph ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm text-muted-foreground" type="button">
                  <LayoutGrid className="size-4" />
                  Layout
                </button>
                <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm text-muted-foreground" type="button">
                  <Filter className="size-4" />
                  Filter
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground" type="button">
                  <Search className="size-4" />
                </button>
                {artifact ? (
                  <span className={artifactStatusVariant(artifact.status)}>
                    {artifact.status.replace('_', ' ')}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="h-[680px] overflow-hidden bg-background">
            <ReactFlow
              colorMode={resolvedTheme === "dark" ? "dark" : "light"}
              edges={graph.edges}
              fitView
              fitViewOptions={{ padding: 0.18 }}
              maxZoom={1.25}
              minZoom={0.45}
              nodes={graph.nodes}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => setSelectedConceptId(node.id)}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={18} size={1} />
              <Controls className="!shadow-none" position="bottom-right" showInteractive={false} />
              <FlowToolbar />
            </ReactFlow>
            </div>
          </div>

          <ConceptDetailPanel
            concept={selectedConcept}
            relationships={relationships}
            conceptNameById={conceptNameById}
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <ConceptList concepts={concepts} />
          <aside className="rounded-[1.5rem] border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Relationships</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              No relationship links were generated. This graph can still be reviewed as a flat concept list.
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}

function ConceptNode({ data }: NodeProps<Node<ConceptNodeData, 'concept'>>) {
  return (
    <div className="w-52 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
      <Handle
        className="!h-2.5 !w-2.5 !border-background !bg-brand-accent"
        position={Position.Left}
        type="target"
      />
      <p className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">{data.label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className={conceptDifficultyVariants({ difficulty: data.difficulty })}>{data.difficulty}</span>
        <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
          {formatConfidence(data.confidence)}
        </span>
      </div>
      <Handle
        className="!h-2.5 !w-2.5 !border-background !bg-brand-accent"
        position={Position.Right}
        type="source"
      />
    </div>
  );
}

export function ConceptDetailPanel({
  concept,
  relationships,
  conceptNameById,
}: {
  concept: ConceptRow | null;
  conceptNameById: Map<string, string>;
  relationships: RelationshipRow[];
}) {
  if (!concept) {
    return null;
  }

  const outgoing = relationships.filter(
    (relationship) => relationship.sourceConceptId === concept.id
  );
  const incoming = relationships.filter(
    (relationship) => relationship.targetConceptId === concept.id
  );

  return (
    <aside className="space-y-5 rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Detail Konsep</p>
        <div className="rounded-[1.25rem] border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-3xl font-semibold tracking-[-0.03em] text-foreground">
              {concept.name}
            </h3>
            <button className="inline-flex size-9 items-center justify-center rounded-full bg-brand-accent-surface text-brand-accent-foreground" type="button">
              <Star className="size-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={conceptDifficultyVariants({ difficulty: concept.difficulty })}>{concept.difficulty}</span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {formatConfidence(concept.confidence)}
            </span>
          </div>
          <p className="mt-5 text-sm leading-7 text-muted-foreground">{concept.definition}</p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">
          Evidence <span className="text-emerald-500">•</span>
        </p>
        <div className="space-y-3">
          {getEvidence(concept.sourceEvidence).map((evidence) => (
            <blockquote
              className="rounded-[1.25rem] border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-7 text-muted-foreground border-l-4 border-l-emerald-500/50"
              key={`${concept.id}-${evidence.blockId || evidence.excerpt}`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-3xl leading-none text-emerald-500">“</div>
                <span className="rounded-full bg-card/70 px-2 py-0.5 font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
                  {evidence.blockId ? shortenBlockId(evidence.blockId) : 'ref'}
                </span>
              </div>
              <p>{evidence.excerpt}</p>
              <cite className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-xs not-italic text-muted-foreground">
                {evidence.location ? <span>{evidence.location}</span> : null}
                {evidence.sourceId ? <span>{evidence.sourceId.slice(0, 8)}</span> : null}
              </cite>
            </blockquote>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Relasi</h4>
        <p className="text-sm leading-6 text-muted-foreground">
          {incoming.length || outgoing.length
            ? 'Relasi konsep terdeteksi dan tercantum di bawah.'
            : 'Belum ada relasi yang terhubung.'}
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Terhubung ke</h4>
        {incoming.length || outgoing.length ? (
          <ul className="mt-2 space-y-2">
            {incoming.map((relationship) => (
              <li
                className="flex items-center justify-between rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
                key={`in-${relationship.id}`}
              >
                <span>{conceptNameById.get(relationship.sourceConceptId) ?? 'Unknown concept'}</span>
                <span className="rounded-full bg-brand-accent-surface px-2 py-0.5 text-xs text-brand-accent-foreground">
                  {formatRelationshipType(relationship.relationshipType)}
                </span>
              </li>
            ))}
            {outgoing.map((relationship) => (
              <li
                className="flex items-center justify-between rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
                key={`out-${relationship.id}`}
              >
                <span>{conceptNameById.get(relationship.targetConceptId) ?? 'Unknown concept'}</span>
                <span className="rounded-full bg-brand-accent-surface px-2 py-0.5 text-xs text-brand-accent-foreground">
                  {formatRelationshipType(relationship.relationshipType)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Belum ada relasi yang terhubung.</p>
        )}
      </div>
    </aside>
  );
}

export function ConceptList({ concepts }: { concepts: ConceptRow[] }) {
  return (
    <div className="space-y-3">
      {concepts.map((concept) => (
        <article className="rounded-[1.25rem] border border-border bg-card p-4" key={concept.id}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">{concept.name}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{concept.definition}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={conceptDifficultyVariants({ difficulty: concept.difficulty })}>{concept.difficulty}</span>
              <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                {formatConfidence(concept.confidence)}
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {getEvidence(concept.sourceEvidence).map((evidence) => (
              <blockquote
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm leading-6 text-muted-foreground"
                key={`${concept.id}-${evidence.blockId || evidence.excerpt}`}
              >
                {evidence.excerpt}
                {evidence.location ? (
                  <cite className="mt-1 block text-xs not-italic text-muted-foreground">
                    {evidence.location}
                  </cite>
                ) : null}
              </blockquote>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

export function buildConceptGraph(
  concepts: ConceptRow[],
  relationships: RelationshipRow[]
): {
  edges: Edge[];
  nodes: Array<Node<ConceptNodeData, 'concept'>>;
} {
  const depthByConceptId = getDepthByConceptId(concepts, relationships);
  const rowByDepth = new Map<number, number>();

  const nodes = concepts.map((concept) => {
    const depth = depthByConceptId.get(concept.id) ?? 0;
    const row = rowByDepth.get(depth) ?? 0;
    rowByDepth.set(depth, row + 1);

    return {
      data: {
        confidence: concept.confidence,
        difficulty: concept.difficulty,
        label: concept.name,
      },
      id: concept.id,
      position: {
        x: depth * 280,
        y: row * 132 + (depth % 2) * 36,
      },
      type: 'concept' as const,
    };
  });

  const edges = relationships.map((relationship) => ({
    animated: false,
    id: relationship.id,
    markerEnd: {
      color: 'var(--brand-accent)',
      type: MarkerType.ArrowClosed,
    },
    source: relationship.sourceConceptId,
    style: {
      stroke: 'var(--brand-accent)',
      strokeWidth: 2,
    },
    target: relationship.targetConceptId,
  }));

  return {
    edges,
    nodes,
  };
}

function getDepthByConceptId(concepts: ConceptRow[], relationships: RelationshipRow[]) {
  const conceptIds = new Set(concepts.map((concept) => concept.id));
  const incomingCount = new Map(concepts.map((concept) => [concept.id, 0]));
  const outgoing = new Map<string, string[]>();

  for (const relationship of relationships) {
    if (
      !conceptIds.has(relationship.sourceConceptId) ||
      !conceptIds.has(relationship.targetConceptId)
    ) {
      continue;
    }

    incomingCount.set(
      relationship.targetConceptId,
      (incomingCount.get(relationship.targetConceptId) ?? 0) + 1
    );
    outgoing.set(relationship.sourceConceptId, [
      ...(outgoing.get(relationship.sourceConceptId) ?? []),
      relationship.targetConceptId,
    ]);
  }

  const depthByConceptId = new Map<string, number>();
  const queue = concepts.reduce<string[]>((acc, concept) => {
    if ((incomingCount.get(concept.id) ?? 0) === 0) {
      acc.push(concept.id);
    }
    return acc;
  }, []);

  for (const conceptId of queue) {
    depthByConceptId.set(conceptId, 0);
  }

  while (queue.length) {
    const conceptId = queue.shift();

    if (!conceptId) {
      break;
    }

    const nextDepth = (depthByConceptId.get(conceptId) ?? 0) + 1;

    for (const targetId of outgoing.get(conceptId) ?? []) {
      if ((depthByConceptId.get(targetId) ?? -1) < nextDepth) {
        depthByConceptId.set(targetId, nextDepth);
        queue.push(targetId);
      }
    }
  }

  for (const concept of concepts) {
    if (!depthByConceptId.has(concept.id)) {
      depthByConceptId.set(concept.id, 0);
    }
  }

  return depthByConceptId;
}

export type SourceEvidence = {
  blockId?: string;
  excerpt: string;
  location?: string;
  sourceId?: string;
};

export function getEvidence(value: unknown): SourceEvidence[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is SourceEvidence => {
    return (
      typeof item === 'object' &&
      item !== null &&
      'excerpt' in item &&
      typeof item.excerpt === 'string' &&
      item.excerpt.trim().length > 0
    );
  });
}

function shortenBlockId(blockId: string) {
  const parts = blockId.split(':');
  return parts.at(-1) ?? blockId;
}

function formatConfidence(value: string) {
  const confidence = Number(value);

  if (!Number.isFinite(confidence)) {
    return 'confidence n/a';
  }

  return `${Math.round(confidence * 100)}%`;
}

export function formatRelationshipType(value: string) {
  return value.replaceAll('_', ' ');
}

function FlowToolbar() {
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  return (
    <Panel position="top-right">
      <div className="mr-4 mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card/90 p-2 shadow-sm backdrop-blur">
        <button
          className="inline-flex size-9 items-center justify-center rounded-xl border border-border text-muted-foreground"
          onClick={() => zoomOut()}
          type="button"
        >
          <Minus className="size-4" />
        </button>
        <button
          className="inline-flex size-9 items-center justify-center rounded-xl border border-border text-muted-foreground"
          onClick={() => zoomIn()}
          type="button"
        >
          <Plus className="size-4" />
        </button>
        <button
          className="inline-flex size-9 items-center justify-center rounded-xl border border-border text-muted-foreground"
          onClick={() => fitView({ padding: 0.18 })}
          type="button"
        >
          <Expand className="size-4" />
        </button>
      </div>
    </Panel>
  );
}

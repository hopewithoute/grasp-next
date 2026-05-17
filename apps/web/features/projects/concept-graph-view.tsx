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
  relationshipType: string;
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
        <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">
          No concept graph has been generated yet.
        </div>
      ) : hasGraph ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-600" type="button">
                  <LayoutGrid className="size-4" />
                  Layout
                </button>
                <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-600" type="button">
                  <Filter className="size-4" />
                  Filter
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500" type="button">
                  <Search className="size-4" />
                </button>
                {artifact ? (
                  <span className={artifactStatusVariant(artifact.status)}>
                    {artifact.status.replace('_', ' ')}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="h-[680px] overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.08),_transparent_30%),linear-gradient(180deg,_#ffffff,_#f8fafc)]">
            <ReactFlow
              colorMode="light"
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
              <Background color="#e2e8f0" gap={18} size={1} />
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
          <aside className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Prerequisites</h3>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              No prerequisite links were generated. This graph can still be reviewed as a flat
              concept list.
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}

function ConceptNode({ data }: NodeProps<Node<ConceptNodeData, 'concept'>>) {
  return (
    <div className="w-52 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
      <Handle
        className="!h-2.5 !w-2.5 !border-white !bg-[#53d1cb]"
        position={Position.Left}
        type="target"
      />
      <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900">{data.label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className={conceptDifficultyVariants({ difficulty: data.difficulty })}>{data.difficulty}</span>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
          {formatConfidence(data.confidence)}
        </span>
      </div>
      <Handle
        className="!h-2.5 !w-2.5 !border-white !bg-[#53d1cb]"
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
    <aside className="space-y-5 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-900">Detail Konsep</p>
        <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-3xl font-semibold tracking-[-0.03em] text-slate-900">
              {concept.name}
            </h3>
            <button className="inline-flex size-9 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f46e5]" type="button">
              <Star className="size-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={conceptDifficultyVariants({ difficulty: concept.difficulty })}>{concept.difficulty}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
              {formatConfidence(concept.confidence)}
            </span>
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-600">{concept.definition}</p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-900">
          Evidence <span className="text-emerald-500">•</span>
        </p>
        <div className="space-y-3">
          {getEvidence(concept.sourceEvidence).map((evidence, index) => (
            <blockquote
              className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50/40 px-4 py-4 text-sm leading-7 text-slate-600"
              key={`${concept.id}-${index}`}
            >
              <div className="mb-3 text-3xl leading-none text-emerald-500">“</div>
              {evidence.excerpt}
              {evidence.location ? (
                <cite className="mt-3 block text-xs not-italic text-slate-400">
                  {evidence.location}
                </cite>
              ) : null}
            </blockquote>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-900">Prasyarat</h4>
        <p className="text-sm leading-6 text-slate-500">
          {incoming.length || outgoing.length
            ? 'Relasi prerequisite terdeteksi dan tercantum di bawah.'
            : 'Tidak ada prasyarat yang diperlukan.'}
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-900">Terhubung ke</h4>
        {incoming.length || outgoing.length ? (
          <ul className="mt-2 space-y-2">
            {incoming.map((relationship) => (
              <li
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                key={`in-${relationship.id}`}
              >
                <span>{conceptNameById.get(relationship.sourceConceptId) ?? 'Unknown concept'}</span>
                <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-xs text-[#4f46e5]">
                  before this
                </span>
              </li>
            ))}
            {outgoing.map((relationship) => (
              <li
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                key={`out-${relationship.id}`}
              >
                <span>{conceptNameById.get(relationship.targetConceptId) ?? 'Unknown concept'}</span>
                <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-xs text-[#4f46e5]">
                  after this
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-6 text-slate-500">Belum ada relasi yang terhubung.</p>
        )}
      </div>
    </aside>
  );
}

export function ConceptList({ concepts }: { concepts: ConceptRow[] }) {
  return (
    <div className="space-y-3">
      {concepts.map((concept) => (
        <article className="rounded-[1.25rem] border border-slate-200 bg-white p-4" key={concept.id}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900">{concept.name}</h3>
              <p className="text-sm leading-6 text-slate-600">{concept.definition}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={conceptDifficultyVariants({ difficulty: concept.difficulty })}>{concept.difficulty}</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                {formatConfidence(concept.confidence)}
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {getEvidence(concept.sourceEvidence).map((evidence, index) => (
              <blockquote
                className="rounded-xl border border-emerald-200 bg-emerald-50/40 px-3 py-3 text-sm leading-6 text-slate-600"
                key={`${concept.id}-${index}`}
              >
                {evidence.excerpt}
                {evidence.location ? (
                  <cite className="mt-1 block text-xs not-italic text-slate-400">
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
      color: '#53d1cb',
      type: MarkerType.ArrowClosed,
    },
    source: relationship.sourceConceptId,
    style: {
      stroke: '#53d1cb',
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
  const queue = concepts
    .filter((concept) => (incomingCount.get(concept.id) ?? 0) === 0)
    .map((concept) => concept.id);

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

type SourceEvidence = {
  excerpt: string;
  location?: string;
};

function getEvidence(value: unknown): SourceEvidence[] {
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

function formatConfidence(value: string) {
  const confidence = Number(value);

  if (!Number.isFinite(confidence)) {
    return 'confidence n/a';
  }

  return `${Math.round(confidence * 100)}%`;
}

function FlowToolbar() {
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  return (
    <Panel position="top-right">
      <div className="mr-4 mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/92 p-2 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur">
        <button
          className="inline-flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500"
          onClick={() => zoomOut()}
          type="button"
        >
          <Minus className="size-4" />
        </button>
        <button
          className="inline-flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500"
          onClick={() => zoomIn()}
          type="button"
        >
          <Plus className="size-4" />
        </button>
        <button
          className="inline-flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500"
          onClick={() => fitView({ padding: 0.18 })}
          type="button"
        >
          <Expand className="size-4" />
        </button>
      </div>
    </Panel>
  );
}

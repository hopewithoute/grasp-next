'use client';

import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { useMemo, useState } from 'react';

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
  const canApprove = artifact?.status === 'generated' || artifact?.status === 'needs_revision';
  const canRequestRevision = artifact?.status === 'generated';
  const hasGraph = concepts.length > 0 && relationships.length > 0;

  return (
    <section className="space-y-5 rounded-md border border-[#171916]/15 bg-[#fbfcf8] p-5 shadow-[6px_6px_0_#c8d8e8]">
      <div className="flex flex-col gap-4 border-b border-[#171916]/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-[0.24em] text-[#5c634f] uppercase">
            Concept review
          </p>
          <h2 className="text-xl font-semibold">Generated concept graph</h2>
          <p className="max-w-2xl text-sm leading-6 text-[#5c634f]">
            Review the extracted concepts, evidence excerpts, and prerequisite links before allowing
            downstream lesson generation.
          </p>
        </div>

        {artifact ? (
          <div className="flex w-full flex-col items-start gap-3 lg:w-80 lg:items-end">
            <span className={artifactStatusClass(artifact.status)}>
              {artifact.status.replace('_', ' ')}
            </span>
            <div data-testid="approve-slot" data-can-approve={String(canApprove)} />
            <div
              data-testid="revision-slot"
              data-can-request-revision={String(canRequestRevision)}
            />
          </div>
        ) : null}
      </div>

      {!concepts.length ? (
        <div className="rounded-md border border-dashed border-[#171916]/20 bg-white px-4 py-8 text-sm text-[#5c634f]">
          No concept graph has been generated yet.
        </div>
      ) : hasGraph ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-[520px] overflow-hidden rounded-md border border-[#171916]/15 bg-[#f2f5ec]">
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
              <Background color="#c9d4bb" gap={18} size={1} />
              <Controls position="bottom-right" showInteractive={false} />
            </ReactFlow>
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
          <aside className="rounded-md border border-[#171916]/10 bg-white p-4">
            <h3 className="text-sm font-semibold">Prerequisites</h3>
            <p className="mt-3 text-sm leading-6 text-[#5c634f]">
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
    <div className="w-52 rounded-md border border-[#171916]/20 bg-white px-3 py-2 shadow-[4px_4px_0_#d7e0bf]">
      <Handle
        className="!h-2 !w-2 !border-[#171916]/30 !bg-[#9db46f]"
        position={Position.Left}
        type="target"
      />
      <p className="line-clamp-2 text-sm font-semibold leading-5 text-[#171916]">{data.label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className={difficultyClass(data.difficulty)}>{data.difficulty}</span>
        <span className="rounded-full bg-[#f1f3ec] px-2 py-1 text-xs font-medium text-[#4f5a45]">
          {formatConfidence(data.confidence)}
        </span>
      </div>
      <Handle
        className="!h-2 !w-2 !border-[#171916]/30 !bg-[#315f94]"
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
    <aside className="space-y-4 rounded-md border border-[#171916]/10 bg-white p-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.2em] text-[#6a725f] uppercase">
          Selected concept
        </p>
        <h3 className="text-lg font-semibold">{concept.name}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className={difficultyClass(concept.difficulty)}>{concept.difficulty}</span>
          <span className="rounded-full bg-[#f1f3ec] px-2 py-1 text-xs font-medium text-[#4f5a45]">
            {formatConfidence(concept.confidence)}
          </span>
        </div>
        <p className="text-sm leading-6 text-[#3b4035]">{concept.definition}</p>
      </div>

      <div>
        <h4 className="text-sm font-semibold">Evidence</h4>
        <div className="mt-2 space-y-2">
          {getEvidence(concept.sourceEvidence).map((evidence, index) => (
            <blockquote
              className="border-l-2 border-[#9db46f] bg-[#f7f8f4] px-3 py-2 text-sm leading-6 text-[#4a513f]"
              key={`${concept.id}-${index}`}
            >
              {evidence.excerpt}
              {evidence.location ? (
                <cite className="mt-1 block text-xs not-italic text-[#6a725f]">
                  {evidence.location}
                </cite>
              ) : null}
            </blockquote>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold">Prerequisite links</h4>
        {incoming.length || outgoing.length ? (
          <ul className="mt-2 space-y-2">
            {incoming.map((relationship) => (
              <li
                className="rounded border border-[#171916]/10 bg-[#f7f8f4] px-3 py-2 text-sm text-[#3b4035]"
                key={`in-${relationship.id}`}
              >
                {conceptNameById.get(relationship.sourceConceptId) ?? 'Unknown concept'}{' '}
                <span className="text-[#7a846d]">before this</span>
              </li>
            ))}
            {outgoing.map((relationship) => (
              <li
                className="rounded border border-[#171916]/10 bg-[#f7f8f4] px-3 py-2 text-sm text-[#3b4035]"
                key={`out-${relationship.id}`}
              >
                This <span className="text-[#7a846d]">before</span>{' '}
                {conceptNameById.get(relationship.targetConceptId) ?? 'Unknown concept'}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-6 text-[#5c634f]">
            No prerequisite links attach to this concept.
          </p>
        )}
      </div>
    </aside>
  );
}

export function ConceptList({ concepts }: { concepts: ConceptRow[] }) {
  return (
    <div className="space-y-3">
      {concepts.map((concept) => (
        <article className="rounded-md border border-[#171916]/10 bg-white p-4" key={concept.id}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h3 className="text-base font-semibold">{concept.name}</h3>
              <p className="text-sm leading-6 text-[#3b4035]">{concept.definition}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={difficultyClass(concept.difficulty)}>{concept.difficulty}</span>
              <span className="rounded-full bg-[#f1f3ec] px-2 py-1 text-xs font-medium text-[#4f5a45]">
                {formatConfidence(concept.confidence)}
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {getEvidence(concept.sourceEvidence).map((evidence, index) => (
              <blockquote
                className="border-l-2 border-[#9db46f] bg-[#f7f8f4] px-3 py-2 text-sm leading-6 text-[#4a513f]"
                key={`${concept.id}-${index}`}
              >
                {evidence.excerpt}
                {evidence.location ? (
                  <cite className="mt-1 block text-xs not-italic text-[#6a725f]">
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
      color: '#315f94',
      type: MarkerType.ArrowClosed,
    },
    source: relationship.sourceConceptId,
    style: {
      stroke: '#315f94',
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

function difficultyClass(difficulty: ConceptRow['difficulty']) {
  const classByDifficulty = {
    advanced: 'bg-[#f9e8e2] text-[#9d4c32]',
    beginner: 'bg-[#e9f3df] text-[#4d7135]',
    intermediate: 'bg-[#e7eef8] text-[#315f94]',
  };

  return [
    'rounded-full px-2 py-1 text-xs font-medium capitalize',
    classByDifficulty[difficulty],
  ].join(' ');
}

function artifactStatusClass(status: string) {
  const classByStatus: Record<string, string> = {
    approved: 'bg-green-50 text-green-700',
    failed: 'bg-red-50 text-red-700',
    generated: 'bg-blue-50 text-blue-700',
    generating: 'bg-amber-50 text-amber-700',
    needs_revision: 'bg-orange-50 text-orange-700',
    pending: 'bg-[#ecefe5] text-[#4f5a45]',
    published: 'bg-green-50 text-green-700',
    rejected: 'bg-red-50 text-red-700',
  };

  return [
    'rounded-full px-2.5 py-1 text-xs font-semibold capitalize',
    classByStatus[status] ?? 'bg-[#ecefe5] text-[#4f5a45]',
  ].join(' ');
}

'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Bot, GitBranch, Loader2, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { consumeUIMessageChunks } from '@/lib/ui-message-stream';
import { cn } from '@/lib/utils';

export type IngestionStreamEvent =
  | { type: 'ingestion_started'; sourceId: string; sourceTitle: string }
  | { type: 'chunk_processing'; chunkIndex: number; totalChunks: number }
  | { type: 'agent_thinking'; chunkIndex: number; thinking: string }
  | {
      type: 'retrieval_activity';
      hitCount: number;
      query: string;
      retrievalType: 'concept_search' | 'concept_neighbors';
    }
  | { type: 'concept_extracted'; conceptKey: string; name: string; isNew: boolean }
  | {
      type: 'link_applied';
      candidateId: string;
      relationshipType: string;
      sourceConceptName: string;
      targetConceptName: string;
    }
  | {
      type: 'link_candidate_generated';
      candidateId: string;
      relationshipType: string;
      resolutionType: 'exact' | 'semantic';
      sourceConceptName: string;
      targetConceptName: string;
    }
  | {
      type: 'link_candidate_reviewed';
      candidateId: string;
      confidence: number;
      decision: 'accept' | 'reject';
      evidenceStrength: 'strong' | 'usable' | 'weak' | 'rejected';
      finalEvidenceScore: number;
    }
  | {
      type: 'link_policy_applied';
      candidateId: string;
      decision: 'accept' | 'reject';
      reason: string;
    }
  | {
      type: 'link_rejected';
      candidateId: string;
      reason: string;
      sourceConceptName: string;
      targetConceptName: string;
    }
  | {
      type: 'relation_claim_extracted';
      objectText: string;
      predicate: string;
      subjectText: string;
    }
  | { type: 'relationship_extracted'; source: string; target: string }
  | {
      type: 'evidence_dropped';
      chunkIndex: number;
      droppedConceptKeys: string[];
      droppedRefCount: number;
    }
  | { type: 'ingestion_complete'; conceptCount: number; relationshipCount: number }
  | { type: 'ingestion_failed'; reason: string };

type FeedItem = {
  id: string;
  event: IngestionStreamEvent;
};

type IngestionActivityPanelProps = {
  projectId: string;
};

export type IngestionActivityPanelHandle = {
  startIngestion: (
    sourceId: string,
    sourceTitle: string,
    sourceType: string,
    content: string
  ) => void;
};

export function IngestionActivityPanel({
  projectId,
  ref,
}: IngestionActivityPanelProps & { ref?: React.Ref<IngestionActivityPanelHandle> }) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [feed]);

  const startIngestion = useCallback(
    async (sourceId: string, sourceTitle: string, sourceType: string, content: string) => {
      setIsRunning(true);
      setFeed([]);

      const response = await fetch(`/api/v1/projects/${projectId}/ingestion/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, sourceTitle, sourceType, content }),
      });

      if (!response.ok || !response.body) {
        setIsRunning(false);
        setFeed((f) => [
          ...f,
          {
            id: `err-${Date.now()}`,
            event: { type: 'ingestion_failed', reason: 'Request failed' },
          },
        ]);
        return;
      }

      await consumeUIMessageChunks(response.body, (chunk) => {
        if (chunk.type === 'data-ingestion') {
          const event = chunk.data as IngestionStreamEvent;
          setFeed((f) => [...f, { id: `${event.type}-${Date.now()}-${f.length}`, event }]);
        }
      });

      setIsRunning(false);
    },
    [projectId]
  );

  useImperativeHandle(ref, () => ({ startIngestion }), [startIngestion]);

  return (
    <section className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-2 font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase text-muted-foreground">
            <span
              aria-hidden
              className={cn(
                'size-1.5 rounded-full',
                isRunning ? 'bg-brand-accent pulse-soft' : 'bg-emerald-400'
              )}
            />
            Ingestion
          </span>
          <h3 className="text-sm font-medium tracking-tight text-foreground">Activity</h3>
        </div>
        {isRunning && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-accent-border bg-brand-accent-surface px-2.5 py-1 font-mono text-[0.6rem] tracking-[0.16em] uppercase text-brand-accent-foreground">
            <Loader2 className="size-3 animate-spin" />
            processing
          </span>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3" ref={scrollRef}>
        {feed.length === 0 && !isRunning ? (
          <div className="grid h-full place-items-center px-4">
            <p className="text-center text-xs leading-5 text-muted-foreground">
              Add or update a source to see ingestion activity here.
            </p>
          </div>
        ) : (
          <ol className="space-y-1.5">
            {feed.map((item) => (
              <li key={item.id}>
                <FeedEvent event={item.event} />
              </li>
            ))}
          </ol>
        )}
      </div>

      <footer className="border-t border-border p-3">
        <p className="font-mono text-[0.58rem] tracking-[0.16em] uppercase text-foreground/32">
          Edit source content to refine the knowledge graph
        </p>
      </footer>
    </section>
  );
}

function FeedEvent({ event }: { event: IngestionStreamEvent }) {
  switch (event.type) {
    case 'ingestion_started':
      return (
        <FeedRow icon={<Bot className="size-3" />} tone="muted">
          <TypewriterText text={`Ingesting "${event.sourceTitle}"`} speed={20} />
        </FeedRow>
      );
    case 'chunk_processing':
      return (
        <FeedRow icon={<Loader2 className="size-3 animate-spin" />} tone="muted">
          <TypewriterText text={`Chunk ${event.chunkIndex + 1}/${event.totalChunks}`} speed={15} />
        </FeedRow>
      );
    case 'agent_thinking':
      return (
        <details className="group">
          <summary className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-[0.72rem] leading-5 text-muted-foreground hover:text-muted-foreground">
            <Bot className="mt-0.5 size-3 shrink-0" />
            <span>Reasoning (chunk {event.chunkIndex + 1})</span>
          </summary>
          <p className="ml-5 mt-1 whitespace-pre-wrap rounded-lg bg-white/[0.02] px-2 py-1.5 text-[0.65rem] leading-5 text-muted-foreground">
            <TypewriterText text={event.thinking} speed={8} />
          </p>
        </details>
      );
    case 'concept_extracted':
      return (
        <FeedRow icon={<Sparkles className="size-3" />} tone="accent">
          <TypewriterText text={`${event.isNew ? 'New' : 'Updated'}: ${event.name}`} speed={18} />
        </FeedRow>
      );
    case 'retrieval_activity':
      return (
        <FeedRow icon={<Bot className="size-3" />} tone="muted">
          <TypewriterText
            text={`${formatRetrievalType(event.retrievalType)}: ${event.hitCount} hits for "${event.query}"`}
            speed={15}
          />
        </FeedRow>
      );
    case 'relation_claim_extracted':
      return (
        <FeedRow icon={<GitBranch className="size-3" />} tone="muted">
          <TypewriterText
            text={`Claim: ${event.subjectText} ${formatRelationshipType(event.predicate)} ${event.objectText}`}
            speed={15}
          />
        </FeedRow>
      );
    case 'relationship_extracted':
      return (
        <FeedRow icon={<GitBranch className="size-3" />} tone="accent">
          <TypewriterText text={`${event.source} → ${event.target}`} speed={18} />
        </FeedRow>
      );
    case 'link_candidate_generated':
      return (
        <FeedRow icon={<GitBranch className="size-3" />} tone="muted">
          <TypewriterText
            text={`Candidate (${event.resolutionType}): ${event.sourceConceptName} → ${event.targetConceptName} as ${formatRelationshipType(event.relationshipType)}`}
            speed={15}
          />
        </FeedRow>
      );
    case 'link_candidate_reviewed':
      return (
        <FeedRow
          icon={<Bot className="size-3" />}
          tone={event.decision === 'accept' ? 'accent' : 'muted'}
        >
          <TypewriterText
            text={`Reviewed ${shortCandidateId(event.candidateId)}: ${event.decision}, ${event.evidenceStrength} evidence (${formatScore(event.finalEvidenceScore)})`}
            speed={15}
          />
        </FeedRow>
      );
    case 'link_policy_applied':
      return (
        <FeedRow
          icon={
            event.decision === 'accept' ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <XCircle className="size-3" />
            )
          }
          tone={event.decision === 'accept' ? 'success' : 'muted'}
        >
          <TypewriterText
            text={`Policy ${event.decision}: ${formatReason(event.reason)}`}
            speed={15}
          />
        </FeedRow>
      );
    case 'link_applied':
      return (
        <FeedRow icon={<CheckCircle2 className="size-3" />} tone="success">
          <TypewriterText
            text={`Linked: ${event.sourceConceptName} → ${event.targetConceptName} as ${formatRelationshipType(event.relationshipType)}`}
            speed={15}
          />
        </FeedRow>
      );
    case 'link_rejected':
      return (
        <FeedRow icon={<XCircle className="size-3" />} tone="muted">
          <TypewriterText
            text={`Rejected: ${event.sourceConceptName} → ${event.targetConceptName} (${formatReason(event.reason)})`}
            speed={15}
          />
        </FeedRow>
      );
    case 'evidence_dropped':
      return (
        <FeedRow icon={<XCircle className="size-3" />} tone="error">
          <TypewriterText
            text={`Dropped ${event.droppedRefCount} evidence refs in chunk ${event.chunkIndex + 1}${formatDroppedConcepts(event.droppedConceptKeys)}`}
            speed={15}
          />
        </FeedRow>
      );
    case 'ingestion_complete':
      return (
        <FeedRow icon={<CheckCircle2 className="size-3" />} tone="success">
          <TypewriterText
            text={`Done: ${event.conceptCount} concepts, ${event.relationshipCount} relationships`}
            speed={15}
          />
        </FeedRow>
      );
    case 'ingestion_failed':
      return (
        <FeedRow icon={<XCircle className="size-3" />} tone="error">
          <TypewriterText text={`Failed: ${event.reason}`} speed={15} />
        </FeedRow>
      );
  }

  const _exhaustive: never = event;
  return _exhaustive;
}

function formatRetrievalType(type: 'concept_search' | 'concept_neighbors') {
  return type === 'concept_search' ? 'Concept search' : 'Graph neighbors';
}

function formatRelationshipType(type: string) {
  return type.replaceAll('_', ' ');
}

function formatReason(reason: string) {
  return reason.replaceAll('_', ' ');
}

function formatScore(score: number) {
  return score.toFixed(2);
}

function shortCandidateId(candidateId: string) {
  return candidateId.length > 12 ? `${candidateId.slice(0, 12)}...` : candidateId;
}

function formatDroppedConcepts(conceptKeys: string[]) {
  if (conceptKeys.length === 0) return '';
  return `: ${conceptKeys.join(', ')}`;
}

function FeedRow({
  children,
  icon,
  tone,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  tone: 'muted' | 'accent' | 'success' | 'error';
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg px-2 py-1.5 text-[0.72rem] leading-5',
        tone === 'muted' && 'text-muted-foreground',
        tone === 'accent' && 'text-brand-accent',
        tone === 'success' && 'text-emerald-300',
        tone === 'error' && 'text-red-300'
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function TypewriterText({ text, speed = 20 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;

    const interval = setInterval(() => {
      indexRef.current += 1;
      if (indexRef.current >= text.length) {
        setDisplayed(text);
        clearInterval(interval);
      } else {
        setDisplayed(text.slice(0, indexRef.current));
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <>
      {displayed}
      {displayed.length < text.length && (
        <span className="ml-0.5 inline-block h-3 w-[1.5px] translate-y-[1px] animate-pulse bg-current" />
      )}
    </>
  );
}

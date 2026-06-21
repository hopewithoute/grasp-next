'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, CheckCircle2, GitBranch, Loader2, Sparkles, XCircle } from 'lucide-react';
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
  | {
      type: 'evidence_ingestion_complete';
      passageCount: number;
      sourceStatus: 'candidate' | 'certified' | 'deprecated' | 'rejected';
      warningCount: number;
    }
  | { type: 'ingestion_failed'; reason: string };

export type FeedItem = {
  id: string;
  event: IngestionStreamEvent;
};

type IngestionActivityPanelProps = {
  projectId: string;
  feed: FeedItem[];
  isRunning: boolean;
};

export function IngestionActivityPanel({ feed, isRunning }: IngestionActivityPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [feed]);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="space-y-1">
          <span className="text-muted-foreground inline-flex items-center gap-2 font-mono text-[0.62rem] tracking-[0.18em] uppercase tabular-nums">
            <span
              aria-hidden
              className={cn(
                'size-1.5 rounded-none',
                isRunning ? 'bg-brand-accent animate-pulse-soft' : 'bg-brand-accent'
              )}
            />
            Ingestion
          </span>
          <h3 className="text-foreground font-mono text-xs tracking-widest uppercase">ACTIVITY</h3>
        </div>
        {isRunning && (
          <span className="border-brand-accent/50 bg-brand-accent/10 text-brand-accent inline-flex items-center gap-1.5 rounded-none border px-2.5 py-1 font-mono text-[0.6rem] tracking-widest uppercase">
            <Loader2 className="size-3 animate-spin" />[ PROCESSING ]
          </span>
        )}
      </header>

      <div
        className="[&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50 min-h-0 flex-1 overflow-y-scroll p-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
        ref={scrollRef}
      >
        {feed.length === 0 && !isRunning ? (
          <div className="grid h-full place-items-center px-4">
            <p className="text-muted-foreground/70 text-center font-mono text-[0.65rem] leading-relaxed tracking-widest uppercase">
              [ ADD OR UPDATE A SOURCE TO SEE INGESTION ACTIVITY ]
            </p>
          </div>
        ) : (
          <ol className="space-y-2">
            {feed.map((item) => (
              <li key={item.id}>
                <FeedEvent event={item.event} />
              </li>
            ))}
          </ol>
        )}
      </div>

      <footer className="border-border border-t p-3">
        <p className="text-foreground/50 font-mono text-[0.6rem] tracking-widest uppercase">
          [ EDIT SOURCE CONTENT TO REFINE THE KNOWLEDGEBASE ]
        </p>
      </footer>
    </section>
  );
}

function FeedEvent({ event }: { event: IngestionStreamEvent }) {
  if (event.type === 'agent_thinking') {
    return (
      <details className="group">
        <summary className="text-muted-foreground hover:text-muted-foreground/80 flex cursor-pointer items-start gap-2 rounded-none px-2 py-1.5 font-mono text-[0.65rem] tracking-widest uppercase">
          <Bot className="mt-0.5 size-3 shrink-0" />
          <span>[ REASONING (CHUNK {event.chunkIndex + 1}) ]</span>
        </summary>
        <p className="text-muted-foreground border-brand-accent/30 mt-1 ml-5 rounded-none border-l bg-white/[0.02] py-1.5 pl-3 font-mono text-[0.65rem] leading-relaxed uppercase">
          <TypewriterText text={event.thinking} speed={8} />
        </p>
      </details>
    );
  }

  let icon: React.ReactNode;
  let tone: 'muted' | 'accent' | 'success' | 'error' = 'muted';
  let text = '';
  let speed = 15;

  switch (event.type) {
    case 'ingestion_started':
      icon = <Bot className="size-3" />;
      text = `Ingesting "${event.sourceTitle}"`;
      speed = 20;
      break;
    case 'chunk_processing':
      icon = <Loader2 className="size-3 animate-spin" />;
      text = `Chunk ${event.chunkIndex + 1}/${event.totalChunks}`;
      break;
    case 'concept_extracted':
      icon = <Sparkles className="size-3" />;
      tone = 'accent';
      text = `${event.isNew ? 'New' : 'Updated'}: ${event.name}`;
      speed = 18;
      break;
    case 'retrieval_activity':
      icon = <Bot className="size-3" />;
      text = `${formatRetrievalType(event.retrievalType)}: ${event.hitCount} hits for "${event.query}"`;
      break;
    case 'relation_claim_extracted':
      icon = <GitBranch className="size-3" />;
      text = `Claim: ${event.subjectText} ${formatRelationshipType(event.predicate)} ${event.objectText}`;
      break;
    case 'relationship_extracted':
      icon = <GitBranch className="size-3" />;
      tone = 'accent';
      text = `${event.source} → ${event.target}`;
      speed = 18;
      break;
    case 'link_candidate_generated':
      icon = <GitBranch className="size-3" />;
      text = `Candidate (${event.resolutionType}): ${event.sourceConceptName} → ${event.targetConceptName} as ${formatRelationshipType(event.relationshipType)}`;
      break;
    case 'link_candidate_reviewed':
      icon = <Bot className="size-3" />;
      tone = event.decision === 'accept' ? 'accent' : 'muted';
      text = `Reviewed ${shortCandidateId(event.candidateId)}: ${event.decision}, ${event.evidenceStrength} evidence (${formatScore(event.finalEvidenceScore)})`;
      break;
    case 'link_policy_applied':
      icon =
        event.decision === 'accept' ? (
          <CheckCircle2 className="size-3" />
        ) : (
          <XCircle className="size-3" />
        );
      tone = event.decision === 'accept' ? 'success' : 'muted';
      text = `Policy ${event.decision}: ${formatReason(event.reason)}`;
      break;
    case 'link_applied':
      icon = <CheckCircle2 className="size-3" />;
      tone = 'success';
      text = `Linked: ${event.sourceConceptName} → ${event.targetConceptName} as ${formatRelationshipType(event.relationshipType)}`;
      break;
    case 'link_rejected':
      icon = <XCircle className="size-3" />;
      text = `Rejected: ${event.sourceConceptName} → ${event.targetConceptName} (${formatReason(event.reason)})`;
      break;
    case 'evidence_dropped':
      icon = <XCircle className="size-3" />;
      tone = 'error';
      text = `Dropped ${event.droppedRefCount} evidence refs in chunk ${event.chunkIndex + 1}${formatDroppedConcepts(event.droppedConceptKeys)}`;
      break;
    case 'ingestion_complete':
      icon = <CheckCircle2 className="size-3" />;
      tone = 'success';
      text = `Done: ${event.conceptCount} concepts, ${event.relationshipCount} relationships`;
      break;
    case 'evidence_ingestion_complete':
      icon = <CheckCircle2 className="size-3" />;
      tone = 'success';
      text = `Done: ${event.passageCount} passages indexed${event.warningCount ? `, ${event.warningCount} warnings` : ''}`;
      break;
    case 'ingestion_failed':
      icon = <XCircle className="size-3" />;
      tone = 'error';
      text = `Failed: ${event.reason}`;
      break;
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }

  return (
    <FeedRow icon={icon} tone={tone}>
      <TypewriterText text={text} speed={speed} />
    </FeedRow>
  );
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
        'flex items-start gap-2 rounded-none px-2 py-1.5 font-mono text-[0.65rem] leading-relaxed tracking-widest uppercase',
        tone === 'muted' && 'text-muted-foreground',
        tone === 'accent' && 'text-brand-accent',
        tone === 'success' && 'text-brand-accent',
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

'use client';

import { memo, type ReactNode } from 'react';
import {
  CheckCircle2,
  CircleDashed,
  FileText,
  GitBranch,
  MessageSquareText,
  Quote,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type StreamEvent } from '../types';

export const ChatEvent = memo(function ChatEvent({ event }: { event: StreamEvent }) {
  const tone = getEventTone(event);
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-none border bg-white/[0.02] px-3.5 py-3 text-xs leading-5',
        tone.border
      )}
    >
      <span className={cn('grid size-6 shrink-0 place-items-center rounded-none', tone.iconBg)}>
        {tone.icon}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p
          className={cn(
            'font-mono text-[0.65rem] tracking-wider uppercase tabular-nums',
            tone.label
          )}
        >
          {tone.title}
        </p>
        <p className="text-muted-foreground text-[0.78rem] leading-relaxed">{tone.copy}</p>
      </div>
    </div>
  );
});

function getEventTone(event: StreamEvent): {
  border: string;
  copy: string;
  icon: ReactNode;
  iconBg: string;
  label: string;
  title: string;
} {
  switch (event.type) {
    case 'source_read':
      return {
        border: 'border-border',
        copy: event.title ? event.title : `Source · ${event.sourceId}`,
        icon: <FileText className="size-3.5" strokeWidth={1.5} />,
        iconBg: 'bg-card/50 text-muted-foreground',
        label: 'text-muted-foreground',
        title: 'Source read',
      };
    case 'concept_proposed':
      return {
        border: 'border-brand-accent-border',
        copy: event.definition ? `${event.name} — ${truncate(event.definition, 90)}` : event.name,
        icon: <Sparkles className="size-3.5" strokeWidth={1.5} />,
        iconBg: 'bg-brand-accent/[0.12] text-brand-accent',
        label: 'text-brand-accent-foreground',
        title: 'Concept proposed',
      };
    case 'relationship_proposed':
      return {
        border: 'border-brand-accent-border/18',
        copy: `${event.source} → ${event.target}`,
        icon: <GitBranch className="size-3.5" strokeWidth={1.5} />,
        iconBg: 'bg-brand-accent/[0.08] text-brand-accent',
        label: 'text-brand-accent-foreground',
        title: 'Prerequisite link',
      };
    case 'evidence_attached':
      return {
        border: 'border-border',
        copy: `${event.concept}${event.location ? ` · §${event.location}` : ''} — ${truncate(event.excerpt, 80)}`,
        icon: <Quote className="size-3.5" strokeWidth={1.5} />,
        iconBg: 'bg-card/50 text-muted-foreground',
        label: 'text-muted-foreground',
        title: 'Evidence attached',
      };
    case 'ingestion_complete':
      return {
        border: 'border-brand-accent/20',
        copy: `${event.conceptCount} concepts and ${event.relationshipCount} relationships ingested.`,
        icon: <CheckCircle2 className="size-3.5" strokeWidth={1.5} />,
        iconBg: 'bg-brand-accent/10 text-brand-accent',
        label: 'text-brand-accent',
        title: 'Ingestion complete',
      };
    case 'evidence_ingestion_complete':
      return {
        border: 'border-brand-accent/20',
        copy: `${event.passageCount} passages indexed${event.warningCount ? ` · ${event.warningCount} warnings` : ''}.`,
        icon: <CheckCircle2 className="size-3.5" strokeWidth={1.5} />,
        iconBg: 'bg-brand-accent/10 text-brand-accent',
        label: 'text-brand-accent',
        title: `Evidence ${event.sourceStatus}`,
      };
    case 'agent_activity':
      return {
        border: event.status === 'started' ? 'border-brand-accent-border/18' : 'border-border/60',
        copy: event.detail,
        icon:
          event.status === 'started' ? (
            <CircleDashed className="animate-spin-slow size-3.5" strokeWidth={1.5} />
          ) : (
            <CheckCircle2 className="size-3.5" strokeWidth={1.5} />
          ),
        iconBg:
          event.status === 'started'
            ? 'bg-brand-accent/[0.08] text-brand-accent'
            : 'bg-emerald-500/10 text-emerald-500/70',
        label: event.status === 'started' ? 'text-brand-accent-foreground' : 'text-emerald-500/80',
        title: event.label,
      };
    default:
      return {
        border: 'border-border',
        copy: 'Activity',
        icon: <MessageSquareText className="size-3.5" strokeWidth={1.5} />,
        iconBg: 'bg-card/50 text-muted-foreground',
        label: 'text-muted-foreground',
        title: 'Event',
      };
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

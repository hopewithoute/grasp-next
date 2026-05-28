import { memo, useState } from 'react';
import { Check, X, ArrowRight, Loader2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type ProposalAction = {
  type: 'add_concept' | 'update_concept' | 'delete_concept' | 'add_relationship' | 'delete_relationship' | 'add_evidence' | 'update_evidence' | 'delete_evidence';
  payload: Record<string, boolean | number | string | null | undefined>;
};

export type ProposalPayload = {
  rationale: string;
  actions: ProposalAction[];
};

interface ProposalCardProps {
  proposal: ProposalPayload;
  status: 'pending' | 'approved' | 'rejected';
  onApprove: () => void;
  onReject: () => void;
  isProcessing?: boolean;
}

export const ProposalCard = memo(function ProposalCard({ proposal, status, onApprove, onReject, isProcessing }: ProposalCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      "my-4 flex flex-col overflow-hidden rounded-xl border shadow-sm backdrop-blur-md transition-colors",
      status === 'pending' ? "border-border/50 bg-muted/20" :
      status === 'approved' ? "border-emerald-500/20 bg-emerald-500/5 opacity-80" :
      "border-destructive/20 bg-destructive/5 opacity-80"
    )}>
      <div className="flex items-start justify-between border-b border-border/20 bg-muted/20 px-4 py-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <SparklesIcon />
            <h4 className="text-sm font-semibold text-foreground/90">Proposed Graph Changes</h4>
            {status === 'approved' && (
              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
                <Check className="mr-1 size-3" /> Approved
              </span>
            )}
            {status === 'rejected' && (
              <span className="ml-2 inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                <X className="mr-1 size-3" /> Rejected
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground/80 leading-relaxed">
            {proposal.rationale}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-px bg-border/20">
        {proposal.actions.slice(0, expanded ? undefined : 3).map((action, idx) => (
          <ActionRow key={idx} action={action} />
        ))}
        {proposal.actions.length > 3 && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="bg-background/30 px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
          >
            Show {proposal.actions.length - 3} more changes...
          </button>
        )}
      </div>

      {status === 'pending' && (
        <div className="flex items-center justify-end gap-2 bg-muted/10 p-3">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
            onClick={onReject}
            disabled={isProcessing}
          >
            <X className="mr-1.5 size-3.5" />
            Reject
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-8 text-xs bg-primary/90 hover:bg-primary"
            onClick={onApprove}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Check className="mr-1.5 size-3.5" />
            )}
            Approve & Apply
          </Button>
        </div>
      )}
    </div>
  );
});

function ActionRow({ action }: { action: ProposalAction }) {
  if (action.type === 'add_concept') {
    return (
      <div className="flex items-center gap-3 bg-background/50 px-4 py-2.5">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <span className="text-[10px] font-bold">+</span>
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs font-medium text-foreground/90">Add Concept: {action.payload.name}</span>
          <span className="truncate text-[10px] text-muted-foreground/70">{action.payload.definition}</span>
        </div>
      </div>
    );
  }
  if (action.type === 'delete_concept') {
    return (
      <div className="flex items-center gap-3 bg-background/50 px-4 py-2.5">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <span className="text-[10px] font-bold">-</span>
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs font-medium text-foreground/90 line-through decoration-destructive/50">Delete Concept: {action.payload.conceptKey}</span>
        </div>
      </div>
    );
  }
  if (action.type === 'update_concept') {
    return (
      <div className="flex items-center gap-3 bg-background/50 px-4 py-2.5">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
          <span className="text-[10px] font-bold">~</span>
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs font-medium text-foreground/90">Update Concept: {action.payload.name || action.payload.conceptKey}</span>
        </div>
      </div>
    );
  }
  if (action.type === 'add_relationship') {
    return (
      <div className="flex items-center gap-3 bg-background/50 px-4 py-2.5">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500">
          <span className="text-[10px] font-bold">🔗</span>
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/90">
            <span className="truncate max-w-[100px]">{action.payload.sourceConceptKey}</span>
            <ArrowRight className="size-3 text-muted-foreground/50" />
            <span className="truncate max-w-[100px]">{action.payload.targetConceptKey}</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{String(action.payload.relationshipType ?? '').replace('_', ' ')}</span>
        </div>
      </div>
    );
  }
  if (action.type === 'delete_relationship') {
    return (
      <div className="flex items-center gap-3 bg-background/50 px-4 py-2.5">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <span className="text-[10px] font-bold line-through decoration-destructive/50">🔗</span>
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/90 line-through decoration-destructive/50">
            <span className="truncate max-w-[100px]">{action.payload.sourceConceptKey}</span>
            <ArrowRight className="size-3 text-muted-foreground/50" />
            <span className="truncate max-w-[100px]">{action.payload.targetConceptKey}</span>
          </div>
        </div>
      </div>
    );
  }
  if (action.type === 'update_evidence') {
    return (
      <div className="flex items-center gap-3 bg-background/50 px-4 py-2.5">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
          <span className="text-[10px] font-bold">~</span>
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs font-medium text-foreground/90">Update Evidence: {action.payload.evidenceId}</span>
          <span className="truncate text-[10px] text-muted-foreground/70">{action.payload.evidenceText || action.payload.rationale}</span>
        </div>
      </div>
    );
  }
  if (action.type === 'delete_evidence') {
    return (
      <div className="flex items-center gap-3 bg-background/50 px-4 py-2.5">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <span className="text-[10px] font-bold">-</span>
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs font-medium text-foreground/90 line-through decoration-destructive/50">Delete Evidence: {action.payload.evidenceId}</span>
        </div>
      </div>
    );
  }
  if (action.type === 'add_evidence') {
    return (
      <div className="flex items-center gap-3 bg-background/50 px-4 py-2.5">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <span className="text-[10px] font-bold">+</span>
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs font-medium text-foreground/90">Add Evidence: {action.payload.conceptKey}</span>
          <span className="truncate text-[10px] text-muted-foreground/70">{action.payload.evidenceText || action.payload.rationale}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 bg-background/50 px-4 py-2.5">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Play className="size-3" />
      </div>
      <span className="text-xs font-medium text-foreground/90">{(action.type as string).replaceAll('_', ' ')}</span>
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
    </svg>
  );
}

import { memo, useState } from 'react';
import { ArrowRight, Check, Loader2, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type ProposalAction, type ProposalPayload } from '../types';

interface ProposalCardProps {
  proposal: ProposalPayload;
  status: 'pending' | 'approved' | 'rejected';
  onApprove: () => void;
  onReject: () => void;
  isProcessing?: boolean;
}

export const ProposalCard = memo(function ProposalCard({
  proposal,
  status,
  onApprove,
  onReject,
  isProcessing,
}: ProposalCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        'my-4 flex flex-col overflow-hidden rounded-none border shadow-sm backdrop-blur-md transition-colors',
        status === 'pending'
          ? 'border-border/50 bg-muted/20'
          : status === 'approved'
            ? 'border-brand-accent/20 bg-brand-accent/5 opacity-80'
            : 'border-destructive/20 bg-destructive/5 opacity-80'
      )}
    >
      <div className="border-border/20 bg-muted/20 flex items-start justify-between border-b px-4 py-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <SparklesIcon />
            <h4 className="text-foreground/90 font-mono text-xs tracking-widest uppercase">
              PROPOSED GRAPH CHANGES
            </h4>
            {status === 'approved' && (
              <span className="bg-brand-accent/10 text-brand-accent ml-2 inline-flex items-center rounded-none px-2 py-0.5 font-mono text-[0.65rem] tracking-widest uppercase">
                <Check className="mr-1 size-3" /> APPROVED
              </span>
            )}
            {status === 'rejected' && (
              <span className="bg-destructive/10 text-destructive ml-2 inline-flex items-center rounded-none px-2 py-0.5 font-mono text-[0.65rem] tracking-widest uppercase">
                <X className="mr-1 size-3" /> REJECTED
              </span>
            )}
          </div>
          <p className="text-muted-foreground/80 mt-1 text-xs leading-relaxed">
            {proposal.rationale}
          </p>
        </div>
      </div>

      <div className="bg-border/20 flex flex-col gap-px">
        {proposal.actions.slice(0, expanded ? undefined : 3).map((action, idx) => (
          <ActionRow key={`${action.type}-${idx}`} action={action} />
        ))}
        {proposal.actions.length > 3 && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="bg-background/30 text-muted-foreground hover:bg-muted/40 px-4 py-2 font-mono text-[0.65rem] tracking-widest uppercase transition-colors"
          >
            [ SHOW {proposal.actions.length - 3} MORE CHANGES... ]
          </button>
        )}
      </div>

      {status === 'pending' && (
        <div className="bg-muted/10 flex items-center justify-end gap-2 p-3">
          <Button
            variant="outline"
            size="sm"
            className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 h-8 rounded-none font-mono text-[0.65rem] tracking-widest uppercase"
            onClick={onReject}
            disabled={isProcessing}
          >
            <X className="mr-1.5 size-3.5" />
            REJECT
          </Button>
          <Button
            variant="default"
            size="sm"
            className="bg-brand-accent/20 text-brand-accent hover:bg-brand-accent hover:text-background h-8 rounded-none font-mono text-[0.65rem] tracking-widest uppercase"
            onClick={onApprove}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Check className="mr-1.5 size-3.5" />
            )}
            APPROVE & APPLY
          </Button>
        </div>
      )}
    </div>
  );
});

function ActionRow({ action }: { action: ProposalAction }) {
  let iconNode: React.ReactNode = null;
  let iconClass = '';
  let titleNode: React.ReactNode = null;
  let titleClass = 'text-foreground/90 truncate font-mono text-[0.65rem] tracking-widest uppercase';
  let subtitleNode: React.ReactNode = null;
  let subtitleClass = 'text-muted-foreground/70 truncate font-mono text-[0.65rem]';

  switch (action.type) {
    case 'add_concept':
      iconNode = <span className="font-mono text-[10px] font-bold">[+]</span>;
      iconClass = 'bg-brand-accent/10 text-brand-accent';
      titleNode = `ADD: ${action.payload.name}`;
      subtitleNode = action.payload.definition;
      break;
    case 'delete_concept':
      iconNode = <span className="font-mono text-[10px] font-bold">[-]</span>;
      iconClass = 'bg-destructive/10 text-destructive';
      titleClass = cn(titleClass, 'decoration-destructive/50 line-through');
      titleNode = `DEL: ${action.payload.conceptKey}`;
      break;
    case 'update_concept':
      iconNode = <span className="font-mono text-[10px] font-bold">[~]</span>;
      iconClass = 'bg-amber-500/10 text-amber-500';
      titleNode = `MOD: ${action.payload.name || action.payload.conceptKey}`;
      break;
    case 'add_relationship':
      iconNode = <span className="font-mono text-[10px] font-bold">&gt;&gt;</span>;
      iconClass = 'bg-indigo-500/10 text-indigo-500';
      titleClass =
        'text-foreground/90 flex items-center gap-1.5 font-mono text-[0.65rem] tracking-widest uppercase';
      titleNode = (
        <>
          <span className="max-w-[100px] truncate">{action.payload.sourceConceptKey}</span>
          <ArrowRight className="text-muted-foreground/50 size-3" />
          <span className="max-w-[100px] truncate">{action.payload.targetConceptKey}</span>
        </>
      );
      subtitleNode = String(action.payload.relationshipType ?? '').replace('_', ' ');
      subtitleClass = 'text-muted-foreground/70 font-mono text-[0.65rem] tracking-widest uppercase';
      break;
    case 'delete_relationship':
      iconNode = <span className="font-mono text-[10px] font-bold line-through">&gt;&gt;</span>;
      iconClass = 'bg-destructive/10 text-destructive';
      titleClass =
        'text-foreground/90 decoration-destructive/50 flex items-center gap-1.5 font-mono text-[0.65rem] tracking-widest uppercase line-through';
      titleNode = (
        <>
          <span className="max-w-[100px] truncate">{action.payload.sourceConceptKey}</span>
          <ArrowRight className="text-muted-foreground/50 size-3" />
          <span className="max-w-[100px] truncate">{action.payload.targetConceptKey}</span>
        </>
      );
      break;
    case 'update_evidence':
      iconNode = <span className="font-mono text-[10px] font-bold">[~]</span>;
      iconClass = 'bg-amber-500/10 text-amber-500';
      titleNode = `MOD EVD: ${action.payload.evidenceId}`;
      subtitleNode = action.payload.evidenceText || action.payload.rationale;
      break;
    case 'delete_evidence':
      iconNode = <span className="font-mono text-[10px] font-bold">[-]</span>;
      iconClass = 'bg-destructive/10 text-destructive';
      titleClass = cn(titleClass, 'decoration-destructive/50 line-through');
      titleNode = `DEL EVD: ${action.payload.evidenceId}`;
      break;
    case 'add_evidence':
      iconNode = <span className="font-mono text-[10px] font-bold">[+]</span>;
      iconClass = 'bg-brand-accent/10 text-brand-accent';
      titleNode = `ADD EVD: ${action.payload.conceptKey}`;
      subtitleNode = action.payload.evidenceText || action.payload.rationale;
      break;
    default:
      iconNode = <Play className="size-3" />;
      iconClass = 'bg-muted text-muted-foreground';
      titleNode = (action.type as string).replaceAll('_', ' ');
      break;
  }

  return (
    <div className="bg-background/50 flex items-center gap-3 px-4 py-2.5">
      <div
        className={cn('flex size-6 shrink-0 items-center justify-center rounded-none', iconClass)}
      >
        {iconNode}
      </div>
      <div className="flex min-w-0 flex-col">
        <div className={titleClass}>{titleNode}</div>
        {subtitleNode && <span className={subtitleClass}>{subtitleNode}</span>}
      </div>
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primary"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

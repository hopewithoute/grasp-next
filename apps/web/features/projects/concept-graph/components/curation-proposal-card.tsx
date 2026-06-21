import { memo } from 'react';
import { Check, FileText, Loader2, ShieldAlert, ShieldCheck, ToggleLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type CurationAction, type CurationProposalPayload } from '../types';

interface CurationProposalCardProps {
  proposal: CurationProposalPayload;
  status: 'pending' | 'approved' | 'rejected';
  onApprove: () => void;
  onReject: () => void;
  isProcessing?: boolean;
}

export const CurationProposalCard = memo(function CurationProposalCard({
  proposal,
  status,
  onApprove,
  onReject,
  isProcessing,
}: CurationProposalCardProps) {
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
            <FileText className="text-brand-accent size-4" />
            <h4 className="text-foreground/90 font-mono text-xs tracking-widest uppercase">
              EVIDENCE CURATION
            </h4>
            {status === 'approved' && (
              <span className="bg-brand-accent/10 text-brand-accent ml-2 inline-flex items-center rounded-none px-2 py-0.5 font-mono text-[0.65rem] tracking-widest uppercase">
                <Check className="mr-1 size-3" /> APPLIED
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
        {proposal.actions.map((action, idx) => (
          <CurationActionRow action={action} key={`${action.type}-${idx}`} />
        ))}
      </div>

      {status === 'pending' && (
        <div className="bg-muted/10 flex items-center justify-end gap-2 p-3">
          <Button
            className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 h-8 rounded-none font-mono text-[0.65rem] tracking-widest uppercase"
            disabled={isProcessing}
            onClick={onReject}
            size="sm"
            variant="outline"
          >
            <X className="mr-1.5 size-3.5" />
            REJECT
          </Button>
          <Button
            className="bg-brand-accent/20 text-brand-accent hover:bg-brand-accent hover:text-background h-8 rounded-none font-mono text-[0.65rem] tracking-widest uppercase"
            disabled={isProcessing}
            onClick={onApprove}
            size="sm"
            variant="default"
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

function CurationActionRow({ action }: { action: CurationAction }) {
  let iconNode: React.ReactNode = null;
  let iconClass = '';
  let label = '';
  let detail: string | null = null;

  switch (action.type) {
    case 'certify_passage':
      iconNode = <ShieldCheck className="size-3" />;
      iconClass = 'bg-brand-accent/10 text-brand-accent';
      label = `CERTIFY: ${truncateId(action.passageId)}`;
      break;
    case 'reject_passage':
      iconNode = <ShieldAlert className="size-3" />;
      iconClass = 'bg-destructive/10 text-destructive';
      label = `REJECT: ${truncateId(action.passageId)}`;
      break;
    case 'set_passage_retrieval_enabled':
      iconNode = <ToggleLeft className="size-3" />;
      iconClass = 'bg-amber-500/10 text-amber-500';
      label = `${action.enabled ? 'ENABLE' : 'DISABLE'} RETRIEVAL: ${truncateId(action.passageId)}`;
      break;
    case 'add_quality_warning':
      iconNode = <span className="font-mono text-[10px] font-bold">[!]</span>;
      iconClass = 'bg-orange-500/10 text-orange-500';
      label = `WARN: ${truncateId(action.passageId)}`;
      detail = action.warning;
      break;
    case 'clear_quality_warning':
      iconNode = <span className="font-mono text-[10px] font-bold">[-!]</span>;
      iconClass = 'bg-muted text-muted-foreground';
      label = `CLEAR WARNINGS: ${truncateId(action.passageId)}`;
      if (action.warning) detail = action.warning;
      break;
    default:
      iconNode = <FileText className="size-3" />;
      iconClass = 'bg-muted text-muted-foreground';
      label = (action as { type: string }).type.replaceAll('_', ' ');
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
        <div className="text-foreground/90 truncate font-mono text-[0.65rem] tracking-widest uppercase">
          {label}
        </div>
        {detail && (
          <span className="text-muted-foreground/70 truncate font-mono text-[0.65rem]">
            {detail}
          </span>
        )}
      </div>
    </div>
  );
}

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...`;
}

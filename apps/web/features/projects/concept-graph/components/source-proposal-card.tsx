import { memo } from 'react';
import { Check, ExternalLink, Globe, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type SourceProposalPayload } from '../types';

interface SourceProposalCardProps {
  proposal: SourceProposalPayload;
  status: 'pending' | 'approved' | 'rejected';
  onApprove: () => void;
  onReject: () => void;
  isProcessing?: boolean;
}

export const SourceProposalCard = memo(function SourceProposalCard({
  proposal,
  status,
  onApprove,
  onReject,
  isProcessing,
}: SourceProposalCardProps) {
  return (
    <div
      className={cn(
        'my-4 flex flex-col overflow-hidden rounded-xl border shadow-sm backdrop-blur-md transition-colors',
        status === 'pending'
          ? 'border-border/50 bg-muted/20'
          : status === 'approved'
            ? 'border-emerald-500/20 bg-emerald-500/5 opacity-80'
            : 'border-destructive/20 bg-destructive/5 opacity-80'
      )}
    >
      <div className="border-border/20 bg-muted/20 flex items-start justify-between border-b px-4 py-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Globe className="text-brand-accent size-4" />
            <h4 className="text-foreground/90 text-sm font-semibold">Web Source Proposal</h4>
            {status === 'approved' && (
              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
                <Check className="mr-1 size-3" /> Approved
              </span>
            )}
            {status === 'rejected' && (
              <span className="bg-destructive/10 text-destructive ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium">
                <X className="mr-1 size-3" /> Rejected
              </span>
            )}
          </div>
          <p className="text-muted-foreground/80 mt-1 text-xs leading-relaxed">
            The agent found a web source and wants to add it to the Library to extract concepts.
          </p>
        </div>
      </div>

      <div className="bg-card/30 flex flex-col p-4">
        <div className="mb-2">
          <h5 className="line-clamp-1 text-sm font-semibold">{proposal.title}</h5>
          <a
            href={proposal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-accent mt-0.5 inline-flex items-center gap-1 text-xs hover:underline"
          >
            {proposal.url}
            <ExternalLink className="size-3" />
          </a>
        </div>
        <p className="text-muted-foreground line-clamp-3 text-xs">&quot;{proposal.snippet}&quot;</p>
      </div>

      {status === 'pending' && (
        <div className="border-border/10 bg-muted/10 flex items-center justify-end gap-2 border-t p-3">
          <Button
            variant="outline"
            size="sm"
            className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 h-8 text-xs"
            onClick={onReject}
            disabled={isProcessing}
          >
            <X className="mr-1.5 size-3.5" />
            Reject
          </Button>
          <Button
            variant="default"
            size="sm"
            className="bg-primary/90 hover:bg-primary h-8 text-xs"
            onClick={onApprove}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Check className="mr-1.5 size-3.5" />
            )}
            Approve & Ingest
          </Button>
        </div>
      )}
    </div>
  );
});

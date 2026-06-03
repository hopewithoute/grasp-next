import { memo } from 'react';
import { Check, X, Globe, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
      <div className="flex items-start justify-between border-b border-border/20 bg-muted/20 px-4 py-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-brand-accent" />
            <h4 className="text-sm font-semibold text-foreground/90">Web Source Proposal</h4>
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
            The agent found a web source and wants to add it to the Library to extract concepts.
          </p>
        </div>
      </div>

      <div className="flex flex-col p-4 bg-card/30">
        <div className="mb-2">
          <h5 className="font-semibold text-sm line-clamp-1">{proposal.title}</h5>
          <a
            href={proposal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-accent hover:underline"
          >
            {proposal.url}
            <ExternalLink className="size-3" />
          </a>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-3">
          &quot;{proposal.snippet}&quot;
        </p>
      </div>

      {status === 'pending' && (
        <div className="flex items-center justify-end gap-2 border-t border-border/10 bg-muted/10 p-3">
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
            Approve & Ingest
          </Button>
        </div>
      )}
    </div>
  );
});

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
            <Globe className="text-brand-accent size-4" />
            <h4 className="text-foreground/90 font-mono text-xs tracking-widest uppercase">
              WEB SOURCE PROPOSAL
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
            APPROVE & INGEST
          </Button>
        </div>
      )}
    </div>
  );
});

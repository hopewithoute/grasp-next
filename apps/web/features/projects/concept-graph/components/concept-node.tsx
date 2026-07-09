'use client';

import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Info } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { type ConceptNodeData } from '../types';
import { ConfidencePill, DifficultyChip } from './shared-components';

function getNodeStyle(data: ConceptNodeData) {
  const base = cn(
    'bg-card w-[19rem] rounded-none border px-4 py-3 transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
    data.isUserDefined === false && 'border-dashed'
  );
  const dimming = data.dimmed ? 'opacity-30 grayscale-[50%]' : 'opacity-100';

  if (data.selected) {
    return cn(
      base,
      'border-brand-accent ring-brand-accent/50 scale-[1.02] animate-[pulse_4s_ease-in-out_infinite] shadow-[0_0_20px_-5px_rgba(0,0,0,0.3)] ring-1',
      dimming
    );
  }
  if (data.isHoveredChat) {
    return cn(
      base,
      'relative z-50 scale-[1.05] animate-[pulse_1.5s_ease-in-out_infinite] border-brand-accent shadow-[0_0_25px_-5px_rgba(255,106,0,0.6)] ring-2 ring-brand-accent/60',
      dimming
    );
  }
  if (data.isGhostAdd) {
    return cn(
      base,
      'border-dashed border-brand-accent/50 bg-brand-accent/5 opacity-90 shadow-brand-accent/20',
      dimming
    );
  }
  if (data.isGhostDelete) {
    return cn(
      base,
      'border-destructive/50 bg-destructive/5 border-dashed opacity-50 grayscale',
      dimming
    );
  }
  if (data.isGhostUpdate) {
    return cn(
      base,
      'border-dashed border-blue-500/50 bg-blue-500/5 opacity-90 shadow-[0_0_15px_-3px_rgba(59,130,246,0.2)]',
      dimming
    );
  }
  return cn(
    base,
    'border-border hover:border-brand-accent/50 shadow-sm hover:scale-[1.02]',
    dimming
  );
}

function ProposalControls({
  label,
  badgeClassName,
  acceptClassName,
  data,
}: {
  label: string;
  badgeClassName: string;
  acceptClassName: string;
  data: ConceptNodeData;
}) {
  return (
    <div className="absolute -top-3 right-0 z-10 flex gap-1">
      <span
        className={cn(
          'rounded-none px-1.5 py-0.5 font-mono text-[0.55rem] font-bold tracking-widest uppercase shadow-sm',
          badgeClassName
        )}
      >
        [ {label} ]
      </span>
      {data.onAcceptProposal && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onAcceptProposal?.(data.proposalId!);
          }}
          className={cn('rounded-none px-2 py-0.5 text-xs hover:text-white', acceptClassName)}
        >
          ✓
        </button>
      )}
      {data.onRejectProposal && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onRejectProposal?.(data.proposalId!);
          }}
          className="bg-destructive/20 text-destructive hover:bg-destructive rounded-none px-2 py-0.5 text-xs hover:text-white"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export const ConceptNode = memo(function ConceptNode({
  data,
}: NodeProps<Node<ConceptNodeData, 'concept'>>) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div className={getNodeStyle(data)}>
          {data.isGhostDelete && (
            <div className="bg-background/50 absolute inset-0 z-10 flex items-center justify-center rounded-none backdrop-blur-[1px]">
              <span className="text-destructive font-mono text-[0.6rem] font-bold tracking-widest uppercase">
                [ DELETING ]
              </span>
            </div>
          )}
          {data.isGhostAdd && (
            <ProposalControls
              label="NEW"
              badgeClassName="bg-brand-accent text-background"
              acceptClassName="bg-brand-accent/20 text-brand-accent hover:bg-brand-accent hover:text-background"
              data={data}
            />
          )}
          {data.isGhostUpdate && (
            <ProposalControls
              label="UPDATE"
              badgeClassName="bg-blue-500 text-white"
              acceptClassName="bg-blue-500/20 text-blue-600 hover:bg-blue-500"
              data={data}
            />
          )}
          <Handle
            className="!border-background !bg-brand-accent !h-2.5 !w-2.5"
            position={Position.Left}
            type="target"
          />
          <p className="text-foreground line-clamp-2 font-mono text-xs tracking-widest uppercase">
            {data.label}
            {data.isUserDefined === false && (
              <span className="text-brand-accent ml-1 font-bold" title="Auto-defined topic">
                *
              </span>
            )}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <DifficultyChip difficulty={data.difficulty} />
            <ConfidencePill confidence={data.confidence} />
          </div>
          <Handle
            className="!border-background !bg-brand-accent !h-2.5 !w-2.5"
            position={Position.Right}
            type="source"
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          onClick={() => data.onViewDetails?.()}
          className="text-foreground cursor-pointer font-mono text-[0.65rem] tracking-widest uppercase"
        >
          <Info className="mr-2 size-4" /> [ VIEW DETAILS ]
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}, areConceptNodePropsEqual);

function areConceptNodePropsEqual(
  previous: NodeProps<Node<ConceptNodeData, 'concept'>>,
  next: NodeProps<Node<ConceptNodeData, 'concept'>>
) {
  return (
    previous.data.confidence === next.data.confidence &&
    previous.data.difficulty === next.data.difficulty &&
    previous.data.label === next.data.label &&
    previous.data.selected === next.data.selected &&
    previous.data.isHoveredChat === next.data.isHoveredChat &&
    previous.data.isGhostAdd === next.data.isGhostAdd &&
    previous.data.isGhostUpdate === next.data.isGhostUpdate &&
    previous.data.isGhostDelete === next.data.isGhostDelete &&
    previous.data.dimmed === next.data.dimmed
  );
}

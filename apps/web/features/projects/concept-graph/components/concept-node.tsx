'use client';

import { memo } from 'react';
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ConceptNodeData } from '../types';
import { DifficultyChip, ConfidencePill } from './shared-components';

export const ConceptNode = memo(function ConceptNode({
  data,
}: NodeProps<Node<ConceptNodeData, 'concept'>>) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            'w-56 rounded-2xl border bg-card px-4 py-3 transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
            data.selected
              ? 'border-brand-accent ring-1 ring-brand-accent/50 shadow-[0_0_20px_-5px_rgba(0,0,0,0.3)] scale-[1.02] animate-[pulse_4s_ease-in-out_infinite]'
              : data.isHoveredChat
                ? 'border-[#53d1cb] ring-2 ring-[#53d1cb]/60 shadow-[0_0_25px_-5px_rgba(83,209,203,0.6)] scale-[1.05] animate-[pulse_1.5s_ease-in-out_infinite] z-50 relative'
                : data.isGhostAdd
                  ? 'border-emerald-500/50 border-dashed bg-emerald-500/5 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)] opacity-90'
                  : data.isGhostDelete
                    ? 'border-destructive/50 border-dashed bg-destructive/5 opacity-50 grayscale'
                    : data.isGhostUpdate
                      ? 'border-blue-500/50 border-dashed bg-blue-500/5 shadow-[0_0_15px_-3px_rgba(59,130,246,0.2)] opacity-90'
                      : 'border-border shadow-sm hover:border-brand-accent/50 hover:scale-[1.02]',
            data.dimmed ? 'opacity-30 grayscale-[50%]' : 'opacity-100'
          )}
        >
          {data.isGhostDelete && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/50 backdrop-blur-[1px]">
              <span className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-destructive">
                Deleting
              </span>
            </div>
          )}
          {data.isGhostAdd && (
            <div className="absolute -top-3 right-0 z-10 flex gap-1">
              <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-white shadow-sm">
                New
              </span>
              {data.onAcceptProposal && (
                <button
                  onClick={(e) => { e.stopPropagation(); data.onAcceptProposal?.(data.proposalId!); }}
                  className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-600 hover:bg-emerald-500 hover:text-white"
                >✓</button>
              )}
              {data.onRejectProposal && (
                <button
                  onClick={(e) => { e.stopPropagation(); data.onRejectProposal?.(data.proposalId!); }}
                  className="rounded-full bg-destructive/20 px-2 py-0.5 text-xs text-destructive hover:bg-destructive hover:text-white"
                >✕</button>
              )}
            </div>
          )}
          {data.isGhostUpdate && (
            <div className="absolute -top-3 right-0 z-10 flex gap-1">
              <span className="rounded-full bg-blue-500 px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-white shadow-sm">
                Update
              </span>
              {data.onAcceptProposal && (
                <button
                  onClick={(e) => { e.stopPropagation(); data.onAcceptProposal?.(data.proposalId!); }}
                  className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-500 hover:text-white"
                >✓</button>
              )}
              {data.onRejectProposal && (
                <button
                  onClick={(e) => { e.stopPropagation(); data.onRejectProposal?.(data.proposalId!); }}
                  className="rounded-full bg-destructive/20 px-2 py-0.5 text-xs text-destructive hover:bg-destructive hover:text-white"
                >✕</button>
              )}
            </div>
          )}
          <Handle
            className="!h-2.5 !w-2.5 !border-background !bg-brand-accent"
            position={Position.Left}
            type="target"
          />
          <p className="line-clamp-2 text-[0.82rem] font-medium leading-5 tracking-tight text-foreground">
            {data.label}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <DifficultyChip difficulty={data.difficulty} />
            <ConfidencePill confidence={data.confidence} />
          </div>
          <Handle
            className="!h-2.5 !w-2.5 !border-background !bg-brand-accent"
            position={Position.Right}
            type="source"
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          onClick={() => data.onViewDetails?.()}
          className="cursor-pointer text-[0.82rem] font-medium leading-5 tracking-tight text-foreground"
        >
          <Info className="mr-2 size-4" /> View Details
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


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

export const ConceptNode = memo(function ConceptNode({
  data,
}: NodeProps<Node<ConceptNodeData, 'concept'>>) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            'bg-card w-56 rounded-2xl border px-4 py-3 transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
            data.selected
              ? 'border-brand-accent ring-brand-accent/50 scale-[1.02] animate-[pulse_4s_ease-in-out_infinite] shadow-[0_0_20px_-5px_rgba(0,0,0,0.3)] ring-1'
              : data.isHoveredChat
                ? 'relative z-50 scale-[1.05] animate-[pulse_1.5s_ease-in-out_infinite] border-[#53d1cb] shadow-[0_0_25px_-5px_rgba(83,209,203,0.6)] ring-2 ring-[#53d1cb]/60'
                : data.isGhostAdd
                  ? 'border-dashed border-emerald-500/50 bg-emerald-500/5 opacity-90 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]'
                  : data.isGhostDelete
                    ? 'border-destructive/50 bg-destructive/5 border-dashed opacity-50 grayscale'
                    : data.isGhostUpdate
                      ? 'border-dashed border-blue-500/50 bg-blue-500/5 opacity-90 shadow-[0_0_15px_-3px_rgba(59,130,246,0.2)]'
                      : 'border-border hover:border-brand-accent/50 shadow-sm hover:scale-[1.02]',
            data.dimmed ? 'opacity-30 grayscale-[50%]' : 'opacity-100'
          )}
        >
          {data.isGhostDelete && (
            <div className="bg-background/50 absolute inset-0 z-10 flex items-center justify-center rounded-2xl backdrop-blur-[1px]">
              <span className="text-destructive font-mono text-[0.6rem] font-bold tracking-widest uppercase">
                Deleting
              </span>
            </div>
          )}
          {data.isGhostAdd && (
            <div className="absolute -top-3 right-0 z-10 flex gap-1">
              <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 font-mono text-[0.55rem] font-bold tracking-widest text-white uppercase shadow-sm">
                New
              </span>
              {data.onAcceptProposal && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onAcceptProposal?.(data.proposalId!);
                  }}
                  className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-600 hover:bg-emerald-500 hover:text-white"
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
                  className="bg-destructive/20 text-destructive hover:bg-destructive rounded-full px-2 py-0.5 text-xs hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          )}
          {data.isGhostUpdate && (
            <div className="absolute -top-3 right-0 z-10 flex gap-1">
              <span className="rounded-full bg-blue-500 px-1.5 py-0.5 font-mono text-[0.55rem] font-bold tracking-widest text-white uppercase shadow-sm">
                Update
              </span>
              {data.onAcceptProposal && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onAcceptProposal?.(data.proposalId!);
                  }}
                  className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-500 hover:text-white"
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
                  className="bg-destructive/20 text-destructive hover:bg-destructive rounded-full px-2 py-0.5 text-xs hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          )}
          <Handle
            className="!border-background !bg-brand-accent !h-2.5 !w-2.5"
            position={Position.Left}
            type="target"
          />
          <p className="text-foreground line-clamp-2 text-[0.82rem] leading-5 font-medium tracking-tight">
            {data.label}
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
          className="text-foreground cursor-pointer text-[0.82rem] leading-5 font-medium tracking-tight"
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

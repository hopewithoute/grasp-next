'use client';

import { useCallback, type ReactNode } from 'react';
import { Panel, useReactFlow } from '@xyflow/react';
import { Expand, Minus, Plus } from 'lucide-react';

const FIT_VIEW_OPTIONS = { padding: 0.22 };

export function FlowToolbar() {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const handleFitView = useCallback(() => fitView(FIT_VIEW_OPTIONS), [fitView]);
  const handleZoomIn = useCallback(() => zoomIn(), [zoomIn]);
  const handleZoomOut = useCallback(() => zoomOut(), [zoomOut]);

  return (
    <Panel position="top-right">
      <div className="border-border bg-card/50 mt-3 mr-3 flex items-center gap-1 rounded-full border p-1 shadow-md backdrop-blur">
        <ToolbarButton label="Zoom out" onClick={handleZoomOut}>
          <Minus className="size-3.5" strokeWidth={1.5} />
        </ToolbarButton>
        <ToolbarButton label="Zoom in" onClick={handleZoomIn}>
          <Plus className="size-3.5" strokeWidth={1.5} />
        </ToolbarButton>
        <ToolbarButton label="Fit view" onClick={handleFitView}>
          <Expand className="size-3.5" strokeWidth={1.5} />
        </ToolbarButton>
      </div>
    </Panel>
  );
}

function ToolbarButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="text-muted-foreground hover:bg-muted/50 hover:text-foreground inline-flex size-7 items-center justify-center rounded-full transition-colors"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

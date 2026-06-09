'use client';

import { Activity, Loader2 } from 'lucide-react';
import type { ProjectSourceRecord } from '@grasp/domain';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { IngestionActivityPanel, type FeedItem } from '../../components/ingestion-activity-panel';
import { ProjectSourcesPanel } from '../../components/source-material-form';
import { CollapsedPaneRail, PaneHeader } from './shared-components';

type LibraryPaneProps = {
  projectId: string;
  collapsed: boolean;
  feed: FeedItem[];
  isActivityOpen: boolean;
  isRunning: boolean;
  onCollapseToggle: () => void;
  onIngestionTrigger: (sourceId: string, title: string, type: string, content: string) => void;
  onActivityOpenChange: (open: boolean) => void;
  sources: ProjectSourceRecord[];
};

export function LibraryPane({
  projectId,
  collapsed,
  feed,
  isActivityOpen,
  isRunning,
  onCollapseToggle,
  onIngestionTrigger,
  onActivityOpenChange,
  sources,
}: LibraryPaneProps) {
  if (collapsed) {
    return (
      <CollapsedPaneRail
        ariaLabel="Expand concept inventory"
        meta={`${sources.length} ITEMS`}
        onToggle={onCollapseToggle}
        side="left"
        title="[ SOURCES ]"
      />
    );
  }

  return (
    <aside
      aria-label="Library"
      className="border-border bg-card flex min-h-[520px] flex-col border-b lg:min-h-0 lg:border-r lg:border-b-0"
    >
      <PaneHeader
        meta={
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground font-mono text-[0.62rem] tracking-[0.2em] uppercase">
              {sources.length} ITEMS
            </span>
            <button
              type="button"
              onClick={() => onActivityOpenChange(true)}
              className="border-border/50 bg-background text-foreground hover:border-brand-accent/50 hover:bg-brand-accent/10 hover:text-brand-accent inline-flex items-center gap-2 rounded-none border px-3 py-1 font-mono text-[0.65rem] tracking-[0.2em] uppercase transition-all"
            >
              {isRunning ? (
                <Loader2 className="text-brand-accent size-3 animate-spin" />
              ) : (
                <Activity className="size-3" />
              )}
              [ STATUS ]
            </button>
          </div>
        }
        onCollapseToggle={onCollapseToggle}
        side="left"
        title="[ LIBRARY ]"
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <ProjectSourcesPanel
          projectId={projectId}
          sources={sources}
          onIngestionTrigger={(sourceId, title, type, content) => {
            onIngestionTrigger(sourceId, title, type, content);
          }}
        />
      </div>

      <Dialog open={isActivityOpen} onOpenChange={onActivityOpenChange}>
        <DialogContent className="bg-background flex h-[500px] flex-col overflow-hidden p-0 sm:max-w-[500px]">
          <IngestionActivityPanel projectId={projectId} feed={feed} isRunning={isRunning} />
        </DialogContent>
      </Dialog>
    </aside>
  );
}

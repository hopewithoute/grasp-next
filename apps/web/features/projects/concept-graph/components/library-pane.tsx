'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Loader2 } from 'lucide-react';
import { consumeUIMessageChunks } from '@/lib/ui-message-stream';
import { CollapsedPaneRail, PaneHeader } from './shared-components';
import { ProjectSourcesPanel } from '../../components/source-material-form';
import { IngestionActivityPanel, type FeedItem, type IngestionStreamEvent } from '../../components/ingestion-activity-panel';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { ProjectSourceRecord } from '@grasp/domain';

type LibraryPaneProps = {
  projectId: string;
  collapsed: boolean;
  onCollapseToggle: () => void;
  sources: ProjectSourceRecord[];
};

export function LibraryPane({
  projectId,
  collapsed,
  onCollapseToggle,
  sources,
}: LibraryPaneProps) {
  const router = useRouter();
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  const startIngestion = useCallback(
    async (sourceId: string, sourceTitle: string, sourceType: string, content: string) => {
      setIsRunning(true);
      setFeed([]);
      setIsActivityOpen(true);

      const response = await fetch(`/api/v1/projects/${projectId}/ingestion/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, sourceTitle, sourceType, content }),
      });

      if (!response.ok || !response.body) {
        setIsRunning(false);
        setFeed((f) => [
          ...f,
          {
            id: `err-${Date.now()}`,
            event: { type: 'ingestion_failed', reason: 'Request failed' },
          },
        ]);
        return;
      }

      let hasError = false;

      await consumeUIMessageChunks(response.body, (chunk) => {
        if (chunk.type === 'data-ingestion') {
          const event = chunk.data as IngestionStreamEvent;
          if (event.type === 'ingestion_failed') hasError = true;
          setFeed((f) => [...f, { id: `${event.type}-${Date.now()}-${f.length}`, event }]);
        }
      });

      setIsRunning(false);
      router.refresh();

      if (!hasError) {
        setTimeout(() => setIsActivityOpen(false), 1200);
      }
    },
    [projectId, router]
  );

  if (collapsed) {
    return (
      <CollapsedPaneRail
        ariaLabel="Expand library"
        eyebrow="Library"
        meta={`${sources.length} sources`}
        onToggle={onCollapseToggle}
        side="left"
        title="Inventory"
      />
    );
  }

  return (
    <aside
      aria-label="Library"
      className="flex min-h-[520px] flex-col border-b border-border bg-card lg:min-h-0 lg:border-b-0 lg:border-r"
    >
      <PaneHeader
        eyebrow="Sources"
        meta={
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">{sources.length} Items</span>
            <button
              type="button"
              onClick={() => setIsActivityOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-2.5 py-1 font-mono text-[0.6rem] tracking-[0.16em] uppercase text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {isRunning ? (
                <Loader2 className="size-3 animate-spin text-brand-accent" />
              ) : (
                <Activity className="size-3" />
              )}
              Status
            </button>
          </div>
        }
        onCollapseToggle={onCollapseToggle}
        side="left"
        title="Library"
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <ProjectSourcesPanel
          projectId={projectId}
          sources={sources}
          onIngestionTrigger={(sourceId, title, type, content) => {
            startIngestion(sourceId, title, type, content);
          }}
        />
      </div>

      <Dialog open={isActivityOpen} onOpenChange={setIsActivityOpen}>
        <DialogContent className="sm:max-w-[500px] h-[500px] p-0 overflow-hidden bg-background flex flex-col">
          <IngestionActivityPanel
            projectId={projectId}
            feed={feed}
            isRunning={isRunning}
          />
        </DialogContent>
      </Dialog>
    </aside>
  );
}

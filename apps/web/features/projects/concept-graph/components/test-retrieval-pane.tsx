import { useCallback, useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import {
  EvidenceKbRetrievedPassage,
  EvidenceKbRetrieveResponse,
  EvidenceKbPassage,
} from '@/server/evidence-kb';
import { applyEvidenceKbCurationAction, retrieveEvidenceKbAction } from '../../actions';
import { PassageInspector, EvidenceEmptyState } from './evidence-explorer-pane';

import { PaneHeader } from './shared-components';

export function TestRetrievalPane({
  projectId,
  viewToggle,
}: {
  projectId: string;
  viewToggle?: React.ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [retrievalError, setRetrievalError] = useState<string | null>(null);
  const [retrieval, setRetrieval] = useState<EvidenceKbRetrieveResponse | null>(null);

  const [selectedPassageId, setSelectedPassageId] = useState<string | null>(null);
  const [isApplyingCuration, setIsApplyingCuration] = useState(false);
  const [curationError, setCurationError] = useState<string | null>(null);

  const handleRetrieve = useCallback(async () => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;

    setIsRetrieving(true);
    setRetrievalError(null);
    setSelectedPassageId(null);
    try {
      const result = await retrieveEvidenceKbAction({
        filters: { retrievalEnabled: true },
        projectId,
        query: normalizedQuery,
        topK: 15,
      });
      if (!result.configured) {
        setRetrieval(null);
        setRetrievalError(result.error);
        return;
      }
      setRetrieval(result.retrieval);
    } catch (error) {
      setRetrieval(null);
      setRetrievalError(error instanceof Error ? error.message : 'Retrieval failed.');
    } finally {
      setIsRetrieving(false);
    }
  }, [projectId, query]);

  const handleSelectResult = useCallback((result: EvidenceKbRetrievedPassage) => {
    setSelectedPassageId(result.passage_id);
    setCurationError(null);
  }, []);

  const handleApplyCuration = useCallback(
    async (action: 'certify' | 'clear_warnings' | 'reject' | 'reset' | 'toggle_retrieval') => {
      if (!selectedPassageId) return;

      const currentCtx = retrieval?.contexts.find((c) => c.passage_id === selectedPassageId);
      if (!currentCtx) return;

      setIsApplyingCuration(true);
      setCurationError(null);
      try {
        const actionMap = {
          certify: { type: 'certify_passage', passageId: selectedPassageId },
          reject: { type: 'reject_passage', passageId: selectedPassageId },
          reset: { type: 'reset_passage', passageId: selectedPassageId },
          toggle_retrieval: {
            type: 'set_passage_retrieval_enabled',
            passageId: selectedPassageId,
            enabled: !currentCtx.retrieval_enabled,
          },
          clear_warnings: { type: 'clear_quality_warning', passageId: selectedPassageId },
        } as const;

        await applyEvidenceKbCurationAction({
          actions: [actionMap[action] as any],
          projectId,
        });
        
        // Update local state so it reflects immediately
        setRetrieval((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            contexts: prev.contexts.map((ctx) => {
              if (ctx.passage_id === selectedPassageId) {
                return {
                  ...ctx,
                  status:
                    action === 'certify'
                      ? 'certified'
                      : action === 'reject'
                        ? 'rejected'
                        : action === 'reset'
                          ? 'candidate'
                          : ctx.status,
                  retrieval_enabled:
                    action === 'toggle_retrieval'
                      ? !ctx.retrieval_enabled
                      : ctx.retrieval_enabled,
                };
              }
              return ctx;
            }),
          };
        });
      } catch (error) {
        setCurationError(error instanceof Error ? error.message : 'Failed to apply curation');
      } finally {
        setIsApplyingCuration(false);
      }
    },
    [projectId, selectedPassageId, retrieval]
  );

  const selectedPassageData = useMemo(() => {
    if (!retrieval || !selectedPassageId) return null;
    const ctx = retrieval.contexts.find((c) => c.passage_id === selectedPassageId);
    if (!ctx) return null;

    // Cast EvidenceKbRetrievedPassage to EvidenceKbPassage 
    // because we added the required fields in the backend
    return {
      block_id: '',
      id: ctx.passage_id,
      kind: 'text',
      location: ctx.location,
      order: 0,
      quality_score: ctx.quality_score,
      quality_warnings: [],
      retrieval_enabled: ctx.retrieval_enabled,
      source_id: ctx.source_id,
      status: ctx.status,
      text: ctx.text,
      token_count: ctx.token_count,
    } as unknown as EvidenceKbPassage;
  }, [retrieval, selectedPassageId]);

  return (
    <section className="border-border bg-background flex min-h-[520px] flex-1 flex-col border-b lg:min-h-0 lg:border-b-0">
      <PaneHeader actions={viewToggle} title="Test Retrieval" />
      
      <div className="flex flex-1 min-h-0">
        {/* Left side: Retrieval interface */}
        <div className="flex flex-1 flex-col border-r border-border/40 lg:min-w-[400px]">
          <div className="border-b border-border/40 p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-muted-foreground font-mono text-[0.68rem] tracking-widest uppercase">
                [ SIMULATOR ]
              </span>
            {retrieval && (
              <span className="text-muted-foreground/70 font-mono text-[0.62rem] tracking-widest uppercase">
                {retrieval.contexts.length} HITS · {retrieval.retrievalMode}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <label className="bg-background/50 focus-within:border-brand-accent flex h-10 min-w-0 flex-1 items-center gap-2 border border-border/40 px-3">
              <Search className="text-muted-foreground size-4" />
              <input
                className="text-foreground placeholder:text-muted-foreground/50 flex-1 bg-transparent font-mono text-sm tracking-widest outline-none"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRetrieve();
                }}
                placeholder="[ SIMULATE QUERY... ]"
                value={query}
              />
            </label>
            <button
              className="bg-button-bg text-button-text hover:bg-button-bg/90 disabled:opacity-50 flex h-10 shrink-0 items-center justify-center px-5 font-mono text-[0.7rem] tracking-widest uppercase transition-colors"
              disabled={isRetrieving || !query.trim()}
              onClick={handleRetrieve}
              type="button"
            >
              [ {isRetrieving ? 'RUNNING' : 'RUN'} ]
            </button>
          </div>
          {retrievalError && (
            <p className="text-destructive mt-3 font-mono text-xs uppercase tracking-widest">
              [ {retrievalError} ]
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!retrieval && !isRetrieving && (
            <EvidenceEmptyState label="Run a query to test retrieval logic" />
          )}
          
          {retrieval?.contexts.map((context) => (
            <button
              key={`${retrieval.retrievalRunId}-${context.passage_id}`}
              onClick={() => handleSelectResult(context)}
              className={`block w-full border p-3 text-left transition-colors ${
                selectedPassageId === context.passage_id
                  ? 'border-brand-accent bg-brand-accent-surface'
                  : 'border-border/40 hover:border-brand-accent/40 bg-muted/30'
              }`}
              type="button"
            >
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-muted-foreground font-mono text-[0.62rem] font-semibold tracking-widest uppercase">
                  #{context.final_rank}
                </span>
                <span className="text-muted-foreground font-mono text-[0.62rem] tracking-widest uppercase">
                  SCORE {context.score.toFixed(4)}
                </span>
                {context.bm25_rank && (
                  <span className="text-muted-foreground font-mono text-[0.62rem] tracking-widest uppercase">
                    BM25 {context.bm25_rank}
                  </span>
                )}
                {context.vector_rank && (
                  <span className="text-muted-foreground font-mono text-[0.62rem] tracking-widest uppercase">
                    VEC {context.vector_rank}
                  </span>
                )}
              </div>
              <p className="text-foreground/90 line-clamp-3 font-mono text-xs leading-relaxed">
                {context.text}
              </p>
            </button>
          ))}
          
          {retrieval && retrieval.contexts.length === 0 && (
            <EvidenceEmptyState label="No hits found for query" />
          )}
        </div>
      </div>

      {/* Right side: Inspector */}
      <div className="hidden lg:block lg:w-[350px] xl:w-[420px]">
        {selectedPassageData ? (
          <PassageInspector
            curationError={curationError}
            isApplying={isApplyingCuration}
            onApplyCuration={handleApplyCuration}
            passage={selectedPassageData}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8">
            <EvidenceEmptyState label="Select a result to inspect" />
          </div>
        )}
      </div>
      </div>
    </section>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  EvidenceKbPassage,
  EvidenceKbRetrievedPassage,
  EvidenceKbRetrieveResponse,
} from '@/server/evidence-kb-service';
import {
  applyEvidenceKbCurationAction,
  listEvidenceKbPassagesAction,
  listEvidenceKbSourcesAction,
  retrieveEvidenceKbAction,
  type EvidenceKbPassagesResult,
  type EvidenceKbSourcesResult,
} from '../../actions';
import { PaneHeader } from './shared-components';
import { SourceViewer } from './source-viewer';

type SortField = 'order' | 'quality_score' | 'token_count' | 'status';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'candidate' | 'certified' | 'rejected' | 'deprecated';
type RetrievalFilter = 'all' | 'enabled' | 'disabled';

const PAGE_SIZE = 20;

export function EvidenceExplorerPane({
  projectId,
  viewToggle,
  externalSelectedSourceId,
  onSelectSource,
}: {
  projectId: string;
  viewToggle?: React.ReactNode;
  externalSelectedSourceId?: string | null;
  onSelectSource?: (id: string | null) => void;
}) {
  const [sourcesResult, setSourcesResult] = useState<EvidenceKbSourcesResult | null>(null);
  const [passagesResult, setPassagesResult] = useState<EvidenceKbPassagesResult | null>(null);
  const [internalSelectedSourceId, setInternalSelectedSourceId] = useState<string | null>(null);
  const selectedSourceId = externalSelectedSourceId !== undefined ? externalSelectedSourceId : internalSelectedSourceId;
  const setSelectedSourceId = onSelectSource || setInternalSelectedSourceId;
  
  const [selectedPassageId, setSelectedPassageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'passages' | 'raw'>('passages');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [retrievalFilter, setRetrievalFilter] = useState<RetrievalFilter>('all');
  const [sortField, setSortField] = useState<SortField>('order');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [, setIsLoadingSources] = useState(true);
  const [isLoadingPassages, setIsLoadingPassages] = useState(false);
  const [isApplyingCuration, setIsApplyingCuration] = useState(false);
  const [curationError, setCurationError] = useState<string | null>(null);

  const loadSources = useCallback(async (background = false) => {
    if (!background) setIsLoadingSources(true);
    try {
      const result = await listEvidenceKbSourcesAction(projectId);
      setSourcesResult(result);
      // Only auto-select first source if we didn't already have one
      const firstSourceId = result.configured ? result.sources[0]?.external_source_id : null;
      if (!firstSourceId) {
        setPassagesResult(null);
      }
      if (externalSelectedSourceId === undefined) {
        setSelectedSourceId(firstSourceId ?? null);
      }
    } catch {
      setSourcesResult({ configured: false, error: 'Failed to load sources.', sources: [] });
    } finally {
      if (!background) setIsLoadingSources(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSources();
  }, [loadSources]);

  const loadPassages = useCallback(
    async (sourceId: string, background = false) => {
      if (!background) setIsLoadingPassages(true);
      try {
        const result = await listEvidenceKbPassagesAction({
          projectId,
          sourceId,
          query: query.trim() || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
          retrieval_enabled: retrievalFilter === 'all' ? undefined : retrievalFilter === 'enabled',
          sort_field: sortField,
          sort_direction: sortDirection,
          skip: (currentPage - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
        });
        setPassagesResult(result);
        setSelectedPassageId((current) => {
          if (!result.success) return null;
          if (current && result.data.items.some((passage) => passage.id === current)) return current;
          return result.data.items[0]?.id ?? null;
        });
      } catch {
        setPassagesResult({ success: false, error: 'Failed to load passages.' });
      } finally {
        if (!background) setIsLoadingPassages(false);
      }
    },
    [projectId, query, statusFilter, retrievalFilter, sortField, sortDirection, currentPage]
  );

  const sources = sourcesResult?.configured ? sourcesResult.sources : [];
  const selectedSource = sources.find((s) => s.external_source_id === selectedSourceId) ?? null;
  const internalSourceId = selectedSource?.id;

  useEffect(() => {
    if (internalSourceId) {
      void loadPassages(internalSourceId);
      // Removed the setInterval for background refresh because it would constantly reload the same page and interrupt pagination/filters unless handled carefully.
      // If auto-refresh is needed, it should probably only refresh the current page and use the current state.
      // Since states are in the dependency array of loadPassages, it will re-trigger naturally.
    } else if (!selectedSourceId) {
      setPassagesResult(null);
      setSelectedPassageId(null);
    }
  }, [internalSourceId, selectedSourceId, loadPassages]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurationError(null);
  }, [selectedPassageId]);

  const passages = useMemo(() => (passagesResult?.success ? passagesResult.data.items : []), [passagesResult]);
  const totalPassages = useMemo(() => (passagesResult?.success ? passagesResult.data.total : 0), [passagesResult]);
  const selectedPassage = passages.find((p) => p.id === selectedPassageId) ?? null;

  const handleApplyPassageCuration = useCallback(
    async (action: 'certify' | 'clear_warnings' | 'reject' | 'reset' | 'toggle_retrieval') => {
      if (!selectedPassage || !selectedSource) return;

      setIsApplyingCuration(true);
      setCurationError(null);
      try {
        const actionMap = {
          certify: { type: 'certify_passage', passageId: selectedPassage.id },
          reject: { type: 'reject_passage', passageId: selectedPassage.id },
          reset: { type: 'reset_passage', passageId: selectedPassage.id },
          toggle_retrieval: {
            type: 'set_passage_retrieval_enabled',
            passageId: selectedPassage.id,
            enabled: !selectedPassage.retrieval_enabled,
          },
          clear_warnings: { type: 'clear_quality_warning', passageId: selectedPassage.id },
        } as const;

        await applyEvidenceKbCurationAction({
          projectId,
          actions: [actionMap[action] as any],
        });
        await loadPassages(selectedSource.id);
        setCurrentPage(1);
      } catch (error) {
        setCurationError(error instanceof Error ? error.message : 'Curation action failed.');
      } finally {
        setIsApplyingCuration(false);
      }
    },
    [loadPassages, projectId, selectedPassage, selectedSource]
  );



  const totalPages = Math.ceil(totalPassages / PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  return (
    <section
      aria-label="Evidence explorer"
      className="border-border bg-background flex min-h-[520px] flex-1 flex-col border-b lg:min-h-0 lg:border-b-0"
    >
      <PaneHeader
        meta={
          sourcesResult?.configured
            ? `${sources.length} SOURCES · ${totalPassages} PASSAGES`
            : 'NOT CONFIGURED'
        }
        actions={viewToggle}
        title="[ KNOWLEDGE_BASE ]"
      />

      {!sourcesResult ? (
        <EvidenceEmptyState label="Loading Evidence KB..." />
      ) : !sourcesResult.configured ? (
        <EvidenceEmptyState label={sourcesResult.error} />
      ) : sources.length === 0 ? (
        <EvidenceEmptyState label="No Evidence KB sources indexed yet." onRefresh={loadSources} />
      ) : !selectedSource ? (
        <EvidenceEmptyState label="Select a source from the Library to view its evidence." />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_26rem] overflow-hidden">
          <div className="flex min-h-0 flex-col overflow-hidden border-r border-border/40">
            <div className="flex shrink-0 items-center border-b border-border/40 bg-white/[0.01]">
              <button
                className={cn(
                  'px-6 py-3 font-mono text-[0.65rem] tracking-widest uppercase transition-colors border-b-2',
                  activeTab === 'passages'
                    ? 'border-brand-accent text-brand-accent bg-brand-accent/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.02]'
                )}
                onClick={() => setActiveTab('passages')}
              >
                [ PARSED PASSAGES ]
              </button>
              <button
                className={cn(
                  'px-6 py-3 font-mono text-[0.65rem] tracking-widest uppercase transition-colors border-b-2',
                  activeTab === 'raw'
                    ? 'border-brand-accent text-brand-accent bg-brand-accent/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.02]'
                )}
                onClick={() => setActiveTab('raw')}
              >
                [ VIEW SOURCE ]
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden flex flex-col">
              {activeTab === 'passages' ? (
                <>
                  <PassageFilters
                    currentPage={currentPage}
                    onPageChange={(page) => {
                      setCurrentPage(page);
                      setSelectedPassageId(null);
                    }}
                    onQueryChange={(q) => {
                      setQuery(q);
                      setCurrentPage(1);
                    }}
                    onStatusFilterChange={(val) => {
                      setStatusFilter(val);
                      setCurrentPage(1);
                    }}
                    onRetrievalFilterChange={(val) => {
                      setRetrievalFilter(val);
                      setCurrentPage(1);
                    }}
                    onToggleSort={toggleSort}
                    query={query}
                    sortDirection={sortDirection}
                    sortField={sortField}
                    statusFilter={statusFilter}
                    retrievalFilter={retrievalFilter}
                    totalPages={totalPages}
                    totalPassages={totalPassages}
                  />
                  <PassageList
                    isLoading={isLoadingPassages}
                    onSelect={setSelectedPassageId}
                    passages={passages}
                    selectedPassageId={selectedPassageId}
                  />
                </>
              ) : (
                <SourceViewer projectId={projectId} source={selectedSource as any} />
              )}
            </div>
          </div>

          <PassageInspector
            curationError={curationError}
            isApplying={isApplyingCuration}
            onApplyCuration={handleApplyPassageCuration}
            passage={selectedPassage}
          />
        </div>
      )}
    </section>
  );
}

function PassageFilters({
  currentPage,
  onPageChange,
  onQueryChange,
  onStatusFilterChange,
  onRetrievalFilterChange,
  onToggleSort,
  query,
  sortDirection,
  sortField,
  statusFilter,
  retrievalFilter,
  totalPages,
  totalPassages,
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  onQueryChange: (query: string) => void;
  onStatusFilterChange: (status: StatusFilter) => void;
  onRetrievalFilterChange: (filter: RetrievalFilter) => void;
  onToggleSort: (field: SortField) => void;
  query: string;
  sortDirection: SortDirection;
  sortField: SortField;
  statusFilter: StatusFilter;
  retrievalFilter: RetrievalFilter;
  totalPages: number;
  totalPassages: number;
}) {
  return (
    <div className="border-border/40 border-b bg-white/[0.01] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="border-border/40 bg-background/50 focus-within:border-brand-accent flex h-9 min-w-0 flex-1 items-center gap-2 border px-3">
          <Search className="text-muted-foreground size-3.5" />
          <input
            className="text-foreground placeholder:text-muted-foreground/50 flex-1 bg-transparent font-mono text-[0.65rem] tracking-widest uppercase outline-none"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="[ SEARCH PASSAGES... ]"
            value={query}
          />
        </label>
        <select
          className="border-border/40 bg-background/50 h-9 border px-2 font-mono text-[0.62rem] tracking-widest uppercase"
          onChange={(event) => onStatusFilterChange(event.target.value as StatusFilter)}
          value={statusFilter}
        >
          <option value="all">ALL STATUS</option>
          <option value="candidate">CANDIDATE</option>
          <option value="certified">CERTIFIED</option>
          <option value="rejected">REJECTED</option>
        </select>
        <select
          className="border-border/40 bg-background/50 h-9 border px-2 font-mono text-[0.62rem] tracking-widest uppercase"
          onChange={(event) => onRetrievalFilterChange(event.target.value as RetrievalFilter)}
          value={retrievalFilter}
        >
          <option value="all">ALL RETRIEVAL</option>
          <option value="enabled">ENABLED ONLY</option>
          <option value="disabled">DISABLED ONLY</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground font-mono text-[0.58rem] tracking-widest uppercase">
          SORT:
        </span>
        {(['order', 'quality_score', 'token_count', 'status'] as SortField[]).map((field) => (
          <button
            key={field}
            className={cn(
              'border-border/40 hover:border-brand-accent/50 border px-2 py-1 font-mono text-[0.56rem] tracking-widest uppercase transition-colors',
              sortField === field && 'border-brand-accent/70 bg-brand-accent/10'
            )}
            onClick={() => onToggleSort(field)}
            type="button"
          >
            {field === 'quality_score'
              ? 'QUALITY'
              : field === 'token_count'
                ? 'TOKENS'
                : field.toUpperCase()}
            {sortField === field &&
              (sortDirection === 'asc' ? (
                <ChevronUp className="inline size-3" />
              ) : (
                <ChevronDown className="inline size-3" />
              ))}
          </button>
        ))}
        <span className="text-muted-foreground/70 ml-auto font-mono text-[0.58rem] tracking-widest uppercase">
          {totalPassages} PASSAGES{totalPages > 1 ? ` · PAGE ${currentPage}/${totalPages}` : ''}
        </span>
      </div>
      {totalPages > 1 && (
        <div className="mt-2 flex items-center gap-1">
          <button
            className="border-border/40 hover:border-brand-accent/50 disabled:text-muted-foreground/35 border px-2 py-1 font-mono text-[0.56rem] tracking-widest uppercase"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            type="button"
          >
            PREV
          </button>
          {(() => {
            const windowSize = 5;
            const half = Math.floor(windowSize / 2);
            let start = Math.max(1, currentPage - half);
            const end = Math.min(totalPages, start + windowSize - 1);
            if (end - start < windowSize - 1) {
              start = Math.max(1, end - windowSize + 1);
            }
            const pages: number[] = [];
            if (start > 1) {
              pages.push(1);
              if (start > 2) pages.push(-1);
            }
            for (let p = start; p <= end; p++) pages.push(p);
            if (end < totalPages) {
              if (end < totalPages - 1) pages.push(-1);
              pages.push(totalPages);
            }
            return pages.map((page) =>
              page === -1 ? (
                <span key="ellipsis" className="text-muted-foreground font-mono text-[0.56rem]">
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  className={cn(
                    'border-border/40 hover:border-brand-accent/50 border px-2 py-1 font-mono text-[0.56rem] tracking-widest uppercase',
                    currentPage === page && 'border-brand-accent/70 bg-brand-accent/10'
                  )}
                  onClick={() => onPageChange(page)}
                  type="button"
                >
                  {page}
                </button>
              )
            );
          })()}
          <button
            className="border-border/40 hover:border-brand-accent/50 disabled:text-muted-foreground/35 border px-2 py-1 font-mono text-[0.56rem] tracking-widest uppercase"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            type="button"
          >
            NEXT
          </button>
        </div>
      )}
    </div>
  );
}

function PassageList({
  isLoading,
  onSelect,
  passages,
  selectedPassageId,
}: {
  isLoading: boolean;
  onSelect: (passageId: string) => void;
  passages: EvidenceKbPassage[];
  selectedPassageId: string | null;
}) {
  return (
    <div className="min-h-0 overflow-auto p-3 pb-20">
      {isLoading ? (
        <EvidenceEmptyState label="Loading passages..." compact />
      ) : passages.length === 0 ? (
        <EvidenceEmptyState label="No matching passages." compact />
      ) : (
        <div className="space-y-2">
          {passages.map((passage) => (
            <button
              className={cn(
                'border-border/40 hover:border-brand-accent/40 block w-full border bg-white/[0.01] p-3 text-left transition-colors',
                selectedPassageId === passage.id && 'border-brand-accent/70 bg-brand-accent/10'
              )}
              key={passage.id}
              onClick={() => onSelect(passage.id)}
              type="button"
            >
              <div className="text-muted-foreground mb-2 flex items-center justify-between gap-3 font-mono text-[0.58rem] tracking-widest uppercase">
                <span>
                  #{passage.order + 1} · {passage.status}
                </span>
                <span className="flex items-center gap-2">
                  {!passage.retrieval_enabled && (
                    <span className="text-status-warning-foreground">[ DISABLED ]</span>
                  )}
                  <span className={cn(
                    passage.quality_warnings.length > 0 && "text-status-warning-foreground"
                  )}>
                    {passage.quality_score.toFixed(2)} Q
                  </span>
                  <span>{passage.token_count} TOK</span>
                </span>
              </div>
              <p className="text-foreground/80 line-clamp-3 font-mono text-[0.68rem] leading-relaxed">
                {passage.text}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PassageInspector({
  curationError,
  isApplying,
  onApplyCuration,
  passage,
}: {
  curationError: string | null;
  isApplying: boolean;
  onApplyCuration: (action: 'certify' | 'clear_warnings' | 'reject' | 'toggle_retrieval' | 'reset') => void;
  passage: EvidenceKbPassage | null;
}) {
  if (!passage) {
    return (
      <aside className="border-border/40">
        <EvidenceEmptyState label="Select a passage to inspect." compact />
      </aside>
    );
  }

  return (
    <aside className="border-border/40 min-h-0 overflow-auto bg-white/[0.01] p-4">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="text-brand-accent size-4" />
        <h3 className="text-foreground font-mono text-xs tracking-widest uppercase">
          [ PASSAGE_INSPECTOR ]
        </h3>
      </div>

      <dl className="mb-4 grid grid-cols-2 gap-2 font-mono text-[0.62rem] tracking-widest uppercase">
        <InspectorField label="Status" value={passage.status} />
        <InspectorField label="Quality" value={passage.quality_score.toFixed(2)} />
        <InspectorField label="Tokens" value={String(passage.token_count)} />
        <InspectorField
          label="Retrieval"
          value={passage.retrieval_enabled ? 'enabled' : 'disabled'}
        />
      </dl>

      <div className="mb-4 space-y-2">
        <div className="flex w-full divide-x divide-border/40 border border-border/40">
          <button
            className={cn(
              "flex-1 px-2 py-2 text-center font-mono text-[0.58rem] tracking-widest uppercase transition-colors disabled:cursor-not-allowed",
              passage.status === 'candidate'
                ? "bg-brand-accent/20 text-brand-accent"
                : "text-foreground/80 hover:bg-brand-accent/10 hover:text-brand-accent disabled:text-muted-foreground/35"
            )}
            disabled={isApplying || passage.status === 'candidate'}
            onClick={() => onApplyCuration('reset')}
            type="button"
          >
            Candidate
          </button>
          <button
            className={cn(
              "flex-1 px-2 py-2 text-center font-mono text-[0.58rem] tracking-widest uppercase transition-colors disabled:cursor-not-allowed",
              passage.status === 'certified'
                ? "bg-status-success-surface text-status-success-foreground"
                : "text-foreground/80 hover:bg-status-success-surface/50 hover:text-status-success-foreground disabled:text-muted-foreground/35"
            )}
            disabled={isApplying || passage.status === 'certified'}
            onClick={() => onApplyCuration('certify')}
            type="button"
          >
            Certified
          </button>
          <button
            className={cn(
              "flex-1 px-2 py-2 text-center font-mono text-[0.58rem] tracking-widest uppercase transition-colors disabled:cursor-not-allowed",
              passage.status === 'rejected'
                ? "bg-destructive/20 text-destructive"
                : "text-foreground/80 hover:bg-destructive/10 hover:text-destructive disabled:text-muted-foreground/35"
            )}
            disabled={isApplying || passage.status === 'rejected'}
            onClick={() => onApplyCuration('reject')}
            type="button"
          >
            Rejected
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <CurationButton
            disabled={isApplying}
            label={passage.retrieval_enabled ? 'Disable Retrieval' : 'Enable Retrieval'}
            onClick={() => onApplyCuration('toggle_retrieval')}
          />
          <CurationButton
            disabled={isApplying || passage.quality_warnings.length === 0}
            label="Clear Warnings"
            onClick={() => onApplyCuration('clear_warnings')}
          />
        </div>
      </div>

      {passage.quality_warnings.length ? (
        <div className="border-status-warning-border bg-status-warning-surface text-status-warning-foreground mb-4 border p-3 font-mono text-[0.62rem] tracking-widest uppercase">
          {passage.quality_warnings.join(', ')}
        </div>
      ) : null}

      {curationError ? (
        <div className="border-destructive/40 bg-destructive/10 text-destructive mb-4 border p-3 font-mono text-[0.62rem] tracking-widest uppercase">
          {curationError}
        </div>
      ) : null}

      <pre className="border-border/40 text-foreground/85 border bg-muted/30 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {passage.text}
      </pre>
    </aside>
  );
}

function CurationButton({
  disabled,
  label,
  onClick,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="border-border/40 hover:border-brand-accent/50 hover:text-brand-accent disabled:text-muted-foreground/35 disabled:hover:border-border/40 flex items-center justify-center text-center whitespace-nowrap border px-2 py-2 font-mono text-[0.58rem] tracking-widest uppercase transition-colors disabled:cursor-not-allowed"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      [ {label} ]
    </button>
  );
}

function InspectorField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/40 border p-2">
      <dt className="text-muted-foreground mb-1">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

export function EvidenceEmptyState({
  compact,
  label,
  onRefresh,
}: {
  compact?: boolean;
  label: string;
  onRefresh?: () => void;
}) {
  return (
    <div
      className={cn(
        'grid place-items-center px-4 text-center',
        compact ? 'h-40' : 'min-h-0 flex-1'
      )}
    >
      <div className="space-y-3">
        <p className="text-muted-foreground/70 font-mono text-[0.65rem] leading-relaxed tracking-widest uppercase">
          [ {label} ]
        </p>
        {onRefresh ? (
          <button
            className="border-border/40 hover:border-brand-accent/50 hover:text-brand-accent border px-3 py-2 font-mono text-[0.62rem] tracking-widest uppercase"
            onClick={onRefresh}
            type="button"
          >
            [ Refresh ]
          </button>
        ) : null}
      </div>
    </div>
  );
}

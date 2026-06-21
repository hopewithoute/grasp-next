'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Database, FileText, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  EvidenceKbPassage,
  EvidenceKbRetrievedPassage,
  EvidenceKbRetrieveResponse,
  EvidenceKbSource,
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

type SortField = 'order' | 'quality_score' | 'token_count' | 'status';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'candidate' | 'certified' | 'rejected' | 'deprecated';

const PAGE_SIZE = 20;

export function EvidenceExplorerPane({
  projectId,
  viewToggle,
}: {
  projectId: string;
  viewToggle?: React.ReactNode;
}) {
  const [sourcesResult, setSourcesResult] = useState<EvidenceKbSourcesResult | null>(null);
  const [passagesResult, setPassagesResult] = useState<EvidenceKbPassagesResult | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedPassageId, setSelectedPassageId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('order');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [retrievalQuery, setRetrievalQuery] = useState('');
  const [retrieval, setRetrieval] = useState<EvidenceKbRetrieveResponse | null>(null);
  const [retrievalError, setRetrievalError] = useState<string | null>(null);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [isLoadingPassages, setIsLoadingPassages] = useState(false);
  const [isApplyingCuration, setIsApplyingCuration] = useState(false);
  const [isRetrieving, setIsRetrieving] = useState(false);

  const loadSources = useCallback(async () => {
    try {
      const result = await listEvidenceKbSourcesAction(projectId);
      setSourcesResult(result);
      const firstSourceId = result.configured ? result.sources[0]?.id : null;
      if (!firstSourceId) {
        setPassagesResult(null);
      }
      setSelectedSourceId((current) => current ?? firstSourceId ?? null);
    } finally {
      setIsLoadingSources(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const loadPassages = useCallback(
    async (sourceId: string) => {
      setIsLoadingPassages(true);
      try {
        const result = await listEvidenceKbPassagesAction({ projectId, sourceId });
        setPassagesResult(result);
        setSelectedPassageId((current) => {
          if (!result.configured) return null;
          if (current && result.passages.some((passage) => passage.id === current)) return current;
          return result.passages[0]?.id ?? null;
        });
      } finally {
        setIsLoadingPassages(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    if (selectedSourceId) {
      void loadPassages(selectedSourceId);
    }
  }, [loadPassages, selectedSourceId]);

  const sources = sourcesResult?.configured ? sourcesResult.sources : [];
  const passages = passagesResult?.configured ? passagesResult.passages : [];
  const selectedPassage = passages.find((passage) => passage.id === selectedPassageId) ?? null;

  const filteredAndSortedPassages = useMemo(() => {
    let result = [...passages];

    // Apply text search filter
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery) {
      result = result.filter((passage) => passage.text.toLowerCase().includes(normalizedQuery));
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((passage) => passage.status === statusFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'order':
          comparison = a.order - b.order;
          break;
        case 'quality_score':
          comparison = a.quality_score - b.quality_score;
          break;
        case 'token_count':
          comparison = a.token_count - b.token_count;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [passages, query, statusFilter, sortField, sortDirection]);

  const handleApplyPassageCuration = useCallback(
    async (action: 'certify' | 'clear_warnings' | 'reject' | 'toggle_retrieval') => {
      if (!selectedPassage || !selectedSourceId) return;

      setIsApplyingCuration(true);
      try {
        await applyEvidenceKbCurationAction({
          projectId,
          actions: [
            action === 'certify'
              ? { passageId: selectedPassage.id, type: 'certify_passage' }
              : action === 'reject'
                ? { passageId: selectedPassage.id, type: 'reject_passage' }
                : action === 'toggle_retrieval'
                  ? {
                      enabled: !selectedPassage.retrieval_enabled,
                      passageId: selectedPassage.id,
                      type: 'set_passage_retrieval_enabled',
                    }
                  : { passageId: selectedPassage.id, type: 'clear_quality_warning' },
          ],
        });
        await loadPassages(selectedSourceId);
        setCurrentPage(1);
      } finally {
        setIsApplyingCuration(false);
      }
    },
    [loadPassages, projectId, selectedPassage, selectedSourceId]
  );

  const handleRetrieve = useCallback(async () => {
    const normalizedQuery = retrievalQuery.trim();
    if (!normalizedQuery) return;

    setIsRetrieving(true);
    setRetrievalError(null);
    try {
      const result = await retrieveEvidenceKbAction({
        filters: { retrievalEnabled: true },
        projectId,
        query: normalizedQuery,
        topK: 8,
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
  }, [projectId, retrievalQuery]);

  const handleSelectRetrievedPassage = useCallback(
    (result: EvidenceKbRetrievedPassage) => {
      if (filteredAndSortedPassages.some((passage) => passage.id === result.passage_id)) {
        setSelectedPassageId(result.passage_id);
      }
    },
    [filteredAndSortedPassages]
  );

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedPassages.length / PAGE_SIZE);
  const paginatedPassages = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSortedPassages.slice(start, start + PAGE_SIZE);
  }, [filteredAndSortedPassages, currentPage]);

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
      className="border-border bg-background flex min-h-[520px] flex-1 flex-col border-b lg:min-h-0 lg:border-r lg:border-b-0"
    >
      <PaneHeader
        meta={
          sourcesResult?.configured
            ? `${sources.length} SOURCES · ${filteredAndSortedPassages.length} PASSAGES`
            : 'NOT CONFIGURED'
        }
        actions={viewToggle}
        title="[ EVIDENCE_EXPLORER ]"
      />

      {!sourcesResult ? (
        <EvidenceEmptyState label="Loading Evidence KB..." />
      ) : !sourcesResult.configured ? (
        <EvidenceEmptyState label={sourcesResult.error} />
      ) : sources.length === 0 ? (
        <EvidenceEmptyState label="No Evidence KB sources indexed yet." onRefresh={loadSources} />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[18rem_minmax(0,1fr)_22rem] overflow-hidden">
          <SourceList
            isLoading={isLoadingSources}
            onRefresh={() => {
              setIsLoadingSources(true);
              void loadSources();
            }}
            onSelect={(id) => {
              if (id !== selectedSourceId) {
                setSelectedSourceId(id);
                setPassagesResult(null);
                setCurrentPage(1);
              }
            }}
            selectedSourceId={selectedSourceId}
            sources={sources}
          />

          <div className="min-h-0 overflow-hidden">
            <RetrievalReplay
              error={retrievalError}
              isRetrieving={isRetrieving}
              onQueryChange={setRetrievalQuery}
              onRetrieve={handleRetrieve}
              onSelectResult={handleSelectRetrievedPassage}
              query={retrievalQuery}
              retrieval={retrieval}
            />
            <PassageFilters
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              onQueryChange={(val) => { setQuery(val); setCurrentPage(1); }}
              onStatusFilterChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}
              onToggleSort={toggleSort}
              query={query}
              sortDirection={sortDirection}
              sortField={sortField}
              statusFilter={statusFilter}
              totalPages={totalPages}
              totalPassages={filteredAndSortedPassages.length}
            />
            <PassageList
              isLoading={isLoadingPassages}
              onSelect={setSelectedPassageId}
              passages={paginatedPassages}
              selectedPassageId={selectedPassageId}
            />
          </div>

          <PassageInspector
            isApplying={isApplyingCuration}
            onApplyCuration={handleApplyPassageCuration}
            passage={selectedPassage}
          />
        </div>
      )}
    </section>
  );
}

function SourceList({
  isLoading,
  onRefresh,
  onSelect,
  selectedSourceId,
  sources,
}: {
  isLoading: boolean;
  onRefresh: () => void;
  onSelect: (sourceId: string) => void;
  selectedSourceId: string | null;
  sources: EvidenceKbSource[];
}) {
  return (
    <aside className="border-border/40 min-h-0 border-r bg-white/[0.01]">
      <div className="border-border/40 flex items-center justify-between border-b px-3 py-2">
        <span className="text-muted-foreground font-mono text-[0.62rem] tracking-widest uppercase">
          [ SOURCES ]
        </span>
        <button
          className="text-muted-foreground hover:text-brand-accent inline-flex size-7 items-center justify-center"
          disabled={isLoading}
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw className={cn('size-3', isLoading && 'animate-spin')} />
        </button>
      </div>
      <div className="h-full overflow-auto p-2">
        {sources.map((source) => (
          <button
            className={cn(
              'border-border/40 hover:border-brand-accent/40 block w-full border p-3 text-left transition-colors',
              selectedSourceId === source.id && 'border-brand-accent/70 bg-brand-accent/10'
            )}
            key={source.id}
            onClick={() => onSelect(source.id)}
            type="button"
          >
            <span className="text-foreground line-clamp-2 font-mono text-xs tracking-widest uppercase">
              {source.title}
            </span>
            <span className="text-muted-foreground mt-2 flex items-center gap-2 font-mono text-[0.6rem] tracking-widest uppercase">
              <Database className="size-3" /> {source.status} · {source.source_type}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function RetrievalReplay({
  error,
  isRetrieving,
  onQueryChange,
  onRetrieve,
  onSelectResult,
  query,
  retrieval,
}: {
  error: string | null;
  isRetrieving: boolean;
  onQueryChange: (query: string) => void;
  onRetrieve: () => void;
  onSelectResult: (result: EvidenceKbRetrievedPassage) => void;
  query: string;
  retrieval: EvidenceKbRetrieveResponse | null;
}) {
  return (
    <section className="border-border/40 border-b bg-white/[0.01] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-muted-foreground font-mono text-[0.62rem] tracking-widest uppercase">
          [ RETRIEVAL_REPLAY ]
        </span>
        {retrieval ? (
          <span className="text-muted-foreground/70 font-mono text-[0.58rem] tracking-widest uppercase">
            {retrieval.contexts.length} HITS · {retrieval.retrievalMode}
          </span>
        ) : null}
      </div>
      <div className="flex gap-2">
        <label className="border-border/40 bg-background/50 focus-within:border-brand-accent flex h-9 min-w-0 flex-1 items-center gap-2 border px-3">
          <Search className="text-muted-foreground size-3.5" />
          <input
            className="text-foreground placeholder:text-muted-foreground/50 flex-1 bg-transparent font-mono text-[0.65rem] tracking-widest uppercase outline-none"
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onRetrieve();
            }}
            placeholder="[ REPLAY QUERY... ]"
            value={query}
          />
        </label>
        <button
          className="border-border/40 hover:border-brand-accent/50 hover:text-brand-accent disabled:text-muted-foreground/35 border px-3 font-mono text-[0.62rem] tracking-widest uppercase"
          disabled={isRetrieving || !query.trim()}
          onClick={onRetrieve}
          type="button"
        >
          [ {isRetrieving ? 'Running' : 'Run'} ]
        </button>
      </div>

      {error ? (
        <p className="text-destructive mt-2 font-mono text-[0.62rem] tracking-widest uppercase">
          [ {error} ]
        </p>
      ) : null}

      {retrieval?.contexts.length ? (
        <div className="mt-3 max-h-44 space-y-2 overflow-auto pr-1">
          {retrieval.contexts.map((context) => (
            <button
              className="border-border/40 hover:border-brand-accent/40 block w-full border bg-black/10 p-2 text-left transition-colors"
              key={`${retrieval.retrievalRunId}-${context.passage_id}`}
              onClick={() => onSelectResult(context)}
              type="button"
            >
              <div className="text-muted-foreground mb-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[0.56rem] tracking-widest uppercase">
                <span>#{context.final_rank}</span>
                <span>score {context.score.toFixed(4)}</span>
                <span>bm25 {context.bm25_rank ?? '-'}</span>
                <span>vec {context.vector_rank ?? '-'}</span>
                <span>rrf {context.rrf_score?.toFixed(4) ?? '-'}</span>
              </div>
              <p className="text-foreground/80 line-clamp-2 font-mono text-[0.62rem] leading-relaxed">
                {context.text}
              </p>
            </button>
          ))}
        </div>
      ) : retrieval ? (
        <p className="text-muted-foreground/70 mt-2 font-mono text-[0.62rem] tracking-widest uppercase">
          [ NO HITS ]
        </p>
      ) : null}
    </section>
  );
}

function PassageFilters({
  currentPage,
  onPageChange,
  onQueryChange,
  onStatusFilterChange,
  onToggleSort,
  query,
  sortDirection,
  sortField,
  statusFilter,
  totalPages,
  totalPassages,
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  onQueryChange: (query: string) => void;
  onStatusFilterChange: (status: StatusFilter) => void;
  onToggleSort: (field: SortField) => void;
  query: string;
  sortDirection: SortDirection;
  sortField: SortField;
  statusFilter: StatusFilter;
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
          <option value="deprecated">DEPRECATED</option>
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
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const page = i + 1;
            return (
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
            );
          })}
          {totalPages > 5 && (
            <span className="text-muted-foreground font-mono text-[0.56rem]">...</span>
          )}
          {totalPages > 5 && (
            <button
              className={cn(
                'border-border/40 hover:border-brand-accent/50 border px-2 py-1 font-mono text-[0.56rem] tracking-widest uppercase',
                currentPage === totalPages && 'border-brand-accent/70 bg-brand-accent/10'
              )}
              onClick={() => onPageChange(totalPages)}
              type="button"
            >
              {totalPages}
            </button>
          )}
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
                <span>{passage.token_count} TOK</span>
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

function PassageInspector({
  isApplying,
  onApplyCuration,
  passage,
}: {
  isApplying: boolean;
  onApplyCuration: (action: 'certify' | 'clear_warnings' | 'reject' | 'toggle_retrieval') => void;
  passage: EvidenceKbPassage | null;
}) {
  if (!passage) {
    return (
      <aside className="border-border/40 border-l">
        <EvidenceEmptyState label="Select a passage to inspect." compact />
      </aside>
    );
  }

  return (
    <aside className="border-border/40 min-h-0 overflow-auto border-l bg-white/[0.01] p-4">
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

      <div className="mb-4 grid grid-cols-2 gap-2">
        <CurationButton
          disabled={isApplying || passage.status === 'certified'}
          label="Certify"
          onClick={() => onApplyCuration('certify')}
        />
        <CurationButton
          disabled={isApplying || passage.status === 'rejected'}
          label="Reject"
          onClick={() => onApplyCuration('reject')}
        />
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

      {passage.quality_warnings.length ? (
        <div className="border-status-warning-border bg-status-warning-surface text-status-warning-foreground mb-4 border p-3 font-mono text-[0.62rem] tracking-widest uppercase">
          {passage.quality_warnings.join(', ')}
        </div>
      ) : null}

      <pre className="border-border/40 text-foreground/85 border bg-black/10 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
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
      className="border-border/40 hover:border-brand-accent/50 hover:text-brand-accent disabled:text-muted-foreground/35 disabled:hover:border-border/40 border px-2 py-2 font-mono text-[0.58rem] tracking-widest uppercase transition-colors disabled:cursor-not-allowed"
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

function EvidenceEmptyState({
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

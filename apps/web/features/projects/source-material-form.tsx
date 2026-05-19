'use client';

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  addProjectSourceFormAction,
  deleteProjectSourceFormAction,
  updateProjectSourceFormAction,
} from './actions';
import { IngestionActivityPanel, type IngestionActivityPanelHandle } from './ingestion-activity-panel';
import { sourceModeButtonVariants, sourceTextareaVariants } from './project-style-variants';

export type ProjectSourceItem = {
  content: string | null;
  id: string;
  title: string;
  type: string;
};

type ProjectSourcesPanelProps = {
  projectId: string;
  sources: ProjectSourceItem[];
};

export function ProjectSourcesPanel({ projectId, sources }: ProjectSourcesPanelProps) {
  const [selectedSourceId, setSelectedSourceId] = useState(sources[0]?.id ?? null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const selectedSource = !isAddingNew
    ? (sources.find((source) => source.id === selectedSourceId) ?? sources[0])
    : null;
  const ingestionPanelRef = useRef<IngestionActivityPanelHandle>(null);
  
  return (
    <div className="grid max-h-[calc(100vh-16rem)] gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_18rem]">
      <aside className="flex min-w-0 flex-col gap-3 overflow-hidden xl:h-full">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.18em] uppercase text-[#f3efe3]/42">
            Sources
          </span>
          <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.16em] uppercase text-[#f3efe3]/42">
            {sources.length} total
          </span>
        </div>

        <button
          className="flex w-full shrink-0 items-center justify-center gap-2 rounded-[1.1rem] border border-dashed border-[#53d1cb]/30 bg-[#53d1cb]/[0.04] px-3 py-2.5 text-xs font-medium text-[#53d1cb] transition hover:border-[#53d1cb]/50 hover:bg-[#53d1cb]/[0.08]"
          onClick={() => setIsAddingNew(true)}
          type="button"
        >
          <Plus className="size-3.5" />
          Add source
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto">
        {sources.length ? (
          <ul className="space-y-2">
            {sources.map((source, index) => {
              const counts = getTextCounts(source.content ?? '');

              return (
                <li key={source.id}>
                  <button
                    className={`w-full rounded-[1.1rem] border px-4 py-3 text-left transition ${
                      selectedSource?.id === source.id
                        ? 'border-[#53d1cb]/40 bg-[#53d1cb]/10'
                        : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.06]'
                    }`}
                    onClick={() => { setSelectedSourceId(source.id); setIsAddingNew(false); }}
                    type="button"
                  >
                    <span className="mb-2 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-[#f3efe3]">
                        {source.title}
                      </span>
                      <span className="font-mono text-[0.6rem] text-[#f3efe3]/42">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-xs leading-5 text-[#f3efe3]/52">
                      {getSourcePreview(source.content)}
                    </span>
                    <span className="mt-3 flex items-center justify-between font-mono text-[0.6rem] tracking-[0.14em] text-[#f3efe3]/38 uppercase">
                      <span>{source.type}</span>
                      <span>{counts.words} words</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-[1.1rem] border border-dashed border-white/12 bg-white/[0.025] px-4 py-5 text-sm leading-6 text-[#f3efe3]/52">
            No sources yet. Add markdown or pasted text above.
          </div>
        )}
        </div>
      </aside>

      <section className="space-y-5 overflow-y-auto rounded-[1.75rem] border border-white/10 bg-white/[0.025] p-6">
        <div className="flex flex-col gap-3 border-b border-white/8 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.18em] uppercase text-[#53d1cb]">
              {isAddingNew ? 'new source' : 'source editor'}
            </span>
            <h3 className="text-xl font-medium tracking-tight text-[#f3efe3]">
              {isAddingNew ? 'Add new source' : selectedSource ? selectedSource.title : 'Select a source'}
            </h3>
          </div>
          {selectedSource && !isAddingNew && (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-[#f3efe3]/72">
              <FileText className="size-3.5" />
              {getTextCounts(selectedSource.content ?? '').words} words
            </span>
          )}
        </div>

        {isAddingNew ? (
          <ProjectSourceAddForm projectId={projectId} onIngestionTrigger={(sourceId, title, type, content) => { setIsAddingNew(false); ingestionPanelRef.current?.startIngestion(sourceId, title, type, content); }} />
        ) : selectedSource ? (
          <ProjectSourceEditForm key={selectedSource.id} source={selectedSource} onIngestionTrigger={(sourceId, title, type, content) => ingestionPanelRef.current?.startIngestion(sourceId, title, type, content)} />
        ) : (
          <p className="py-8 text-center text-sm text-[#f3efe3]/52">
            Select a source from the left or add a new one.
          </p>
        )}
      </section>

      <aside className="h-[480px] min-w-0 overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#0a131c] xl:h-full">
        <IngestionActivityPanel projectId={projectId} ref={ingestionPanelRef} />
      </aside>
    </div>
  );
}

function ProjectSourceAddForm({ projectId, onIngestionTrigger }: { projectId: string; onIngestionTrigger?: (sourceId: string, title: string, type: string, content: string) => void }) {
  const [state, formAction, isPending] = useActionState(addProjectSourceFormAction, {
    error: null,
    success: false,
  });
  const formRef = useRef<HTMLFormElement>(null);
  const lastSourceIdRef = useRef<string | null>(null);
  const submittedValuesRef = useRef<{ title: string; type: string; content: string } | null>(null);

  const wrappedAction = (formData: FormData) => {
    submittedValuesRef.current = {
      title: formData.get('title')?.toString() ?? 'Untitled',
      type: formData.get('type')?.toString() ?? 'markdown',
      content: formData.get('content')?.toString() ?? '',
    };
    formAction(formData);
  };

  useEffect(() => {
    if (state.success && state.sourceId && state.sourceId !== lastSourceIdRef.current) {
      lastSourceIdRef.current = state.sourceId;
      const values = submittedValuesRef.current;
      if (values && onIngestionTrigger) {
        onIngestionTrigger(state.sourceId, values.title, values.type, values.content);
      }
    }
  }, [state.success, state.sourceId, onIngestionTrigger]);

  return (
    <ProjectSourceFields
      action={wrappedAction}
      error={state.error}
      formRef={formRef}
      isPending={isPending}
      projectId={projectId}
      submitLabel="Add source"
      success={state.success ? 'Source added.' : null}
    />
  );
}

function ProjectSourceEditForm({ source, onIngestionTrigger }: { source: ProjectSourceItem; onIngestionTrigger?: (sourceId: string, title: string, type: string, content: string) => void }) {
  const [state, formAction, isPending] = useActionState(updateProjectSourceFormAction, {
    error: null,
    success: false,
  });
  const [deleteState, deleteAction, isDeleting] = useActionState(deleteProjectSourceFormAction, {
    error: null,
    success: false,
  });
  const [, startDeleteTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const triggeredRef = useRef(false);
  const submittedValuesRef = useRef<{ title: string; type: string; content: string } | null>(null);

  const wrappedAction = (formData: FormData) => {
    submittedValuesRef.current = {
      title: formData.get('title')?.toString() ?? source.title,
      type: formData.get('type')?.toString() ?? source.type,
      content: formData.get('content')?.toString() ?? source.content ?? '',
    };
    formAction(formData);
  };

  useEffect(() => {
    if (state.success && state.sourceId && !triggeredRef.current) {
      triggeredRef.current = true;
      const values = submittedValuesRef.current;
      if (values && onIngestionTrigger) {
        onIngestionTrigger(state.sourceId, values.title, values.type, values.content);
      }
    } else if (!state.success) {
      triggeredRef.current = false;
    }
  }, [state.success, state.sourceId, onIngestionTrigger]);

  return (
    <div className="space-y-4">
      <ProjectSourceFields
        action={wrappedAction}
        content={source.content ?? ''}
        error={state.error}
        formRef={formRef}
        isPending={isPending}
        sourceId={source.id}
        submitLabel="Save source"
        success={state.success ? 'Source saved.' : null}
        title={source.title}
        type={source.type}
        extraActions={
          <button
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-transparent px-4 text-xs text-[#f3efe3]/62 transition hover:border-status-danger-border hover:bg-status-danger-surface hover:text-status-danger-foreground disabled:opacity-50"
            disabled={isDeleting}
            onClick={() => {
              const formData = new FormData();
              formData.set('sourceId', source.id);
              startDeleteTransition(() => deleteAction(formData));
            }}
            type="button"
          >
            <Trash2 className="size-3.5" />
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        }
      />
      {deleteState.error ? (
        <p className="rounded-[1rem] border border-[#e5685b]/30 bg-[#e5685b]/10 px-3 py-2 text-sm text-[#f3efe3]">
          {deleteState.error}
        </p>
      ) : null}
    </div>
  );
}

function ProjectSourceFields({
  action,
  content = '',
  error,
  extraActions,
  formRef,
  isPending,
  projectId,
  sourceId,
  submitLabel,
  success,
  title = '',
  type = 'markdown',
}: {
  action: (payload: FormData) => void;
  content?: string;
  error: string | null;
  extraActions?: React.ReactNode;
  formRef?: React.RefObject<HTMLFormElement | null>;
  isPending: boolean;
  projectId?: string;
  sourceId?: string;
  submitLabel: string;
  success: string | null;
  title?: string;
  type?: string;
}) {
  const [draft, setDraft] = useState(content);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const counts = useMemo(() => getTextCounts(draft), [draft]);

  return (
    <form action={action} className="space-y-4" ref={formRef}>
      {projectId ? <input name="projectId" type="hidden" value={projectId} /> : null}
      {sourceId ? <input name="sourceId" type="hidden" value={sourceId} /> : null}
      <input name="type" type="hidden" value={type === 'text' ? 'text' : 'markdown'} />

      <div className="space-y-2">
        <label className="text-sm font-medium text-[#f3efe3]/82" htmlFor={`${sourceId ?? 'new'}-title`}>
          Title
        </label>
        <Input
          className="h-11 rounded-2xl border-white/10 bg-[#0d1824] px-4 text-sm text-[#f3efe3] placeholder:text-[#f3efe3]/30 shadow-none focus-visible:border-[#53d1cb]/60 focus-visible:ring-[#53d1cb]/20"
          defaultValue={title}
          id={`${sourceId ?? 'new'}-title`}
          name="title"
          placeholder="Chapter excerpt"
          required
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-sm font-medium text-[#f3efe3]/82" htmlFor={`${sourceId ?? 'new'}-content`}>
            Content
          </label>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#f3efe3]/42 sm:justify-end">
            <span className="font-mono tabular-nums">{counts.words} words</span>
            <span className="font-mono tabular-nums">{counts.characters} chars</span>
            <div className="flex rounded-full border border-white/10 bg-white/[0.035] p-0.5">
              <button
                className={sourceModeButtonVariants({ active: mode === 'edit' })}
                onClick={() => setMode('edit')}
                type="button"
              >
                Edit
              </button>
              <button
                className={sourceModeButtonVariants({ active: mode === 'preview' })}
                onClick={() => setMode('preview')}
                type="button"
              >
                Preview
              </button>
            </div>
          </div>
        </div>

        {mode === 'edit' ? (
          <textarea
            className={sourceTextareaVariants({ compact: false })}
            id={`${sourceId ?? 'new'}-content`}
            name="content"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Paste notes, textbook excerpts, or markdown here."
            required
            value={draft}
          />
        ) : (
          <>
            <input name="content" type="hidden" value={draft} />
            <SourcePreview value={draft} />
          </>
        )}
      </div>

      {error ? (
        <p className="rounded-[1rem] border border-[#e5685b]/30 bg-[#e5685b]/10 px-3 py-2 text-sm text-[#f3efe3]">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="rounded-[1rem] border border-[#00bb7f]/30 bg-[#00bb7f]/10 px-3 py-2 text-sm text-[#f3efe3]">
          {success}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          className="h-9 rounded-full bg-[#53d1cb] px-4 text-[#041018] hover:bg-[#7ceae3]"
          disabled={isPending}
          type="submit"
        >
          <FileText className="mr-1.5 size-3.5" />
          {isPending ? 'Saving...' : submitLabel}
        </Button>
        {extraActions}
      </div>
    </form>
  );
}

function SourcePreview({ value }: { value: string }) {
  const blocks = value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (!blocks.length) {
    return (
      <div className="min-h-[420px] rounded-[1.25rem] border border-dashed border-white/12 bg-white/[0.025] px-4 py-4 text-sm text-[#f3efe3]/42">
        Nothing to preview yet.
      </div>
    );
  }

  return (
    <div className="min-h-[420px] space-y-4 rounded-[1.25rem] border border-white/10 bg-[#0d1824] px-4 py-4 text-sm leading-6 text-[#f3efe3]/82 shadow-[inset_3px_0_0_rgba(83,209,203,0.58),inset_0_1px_0_rgba(255,255,255,0.04)]">
      {blocks.map((block, index) => (
        <p className="whitespace-pre-wrap" key={`${block}-${index}`}>
          {block}
        </p>
      ))}
    </div>
  );
}

function SourceStatRow({
  label,
  unit,
  value,
}: {
  label: string;
  unit: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 bg-[#0d1824]/70 px-4 py-3">
      <dt className="text-sm text-[#f3efe3]/62">{label}</dt>
      <dd className="text-right">
        <div className="text-lg font-medium text-[#f3efe3]">{value}</div>
        <div className="font-mono text-[0.6rem] tracking-[0.16em] text-[#f3efe3]/38 uppercase">
          {unit}
        </div>
      </dd>
    </div>
  );
}

function getSourcePreview(value: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return 'Empty source';
  }

  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
}

function getTextCounts(value: string) {
  const trimmed = value.trim();

  return {
    characters: value.length,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
  };
}

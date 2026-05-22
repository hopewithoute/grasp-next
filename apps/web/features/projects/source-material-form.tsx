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
  const defaultSelectedId = sources.length > 0 && sources[0] ? sources[0].id : null;
  const [selectedSourceId, setSelectedSourceId] = useState(defaultSelectedId);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const selectedSource = !isAddingNew
    ? (sources.find((source) => source.id === selectedSourceId) ?? sources[0])
    : null;
  const ingestionPanelRef = useRef<IngestionActivityPanelHandle>(null);
  
  return (
    <div className="grid gap-6 xl:h-[calc(100vh-16rem)] xl:grid-cols-[18rem_minmax(0,1fr)_18rem]">
      <aside className="flex min-w-0 flex-col gap-3 overflow-hidden xl:h-full">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.18em] uppercase text-muted-foreground">
            Sources
          </span>
          <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.16em] uppercase text-muted-foreground">
            {sources.length} total
          </span>
        </div>

        <button
          className="flex w-full shrink-0 items-center justify-center gap-2 rounded-[1.1rem] border border-dashed border-brand-accent-border/30 bg-brand-accent/[0.04] px-3 py-2.5 text-xs font-medium text-brand-accent-foreground transition hover:border-brand-accent-border hover:bg-brand-accent/[0.08]"
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
                        ? 'border-brand-accent-border bg-brand-accent-surface'
                        : 'border-border bg-white/[0.035] hover:bg-muted/50'
                    }`}
                    onClick={() => { setSelectedSourceId(source.id); setIsAddingNew(false); }}
                    type="button"
                  >
                    <span className="mb-2 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {source.title}
                      </span>
                      <span className="font-mono text-[0.6rem] text-muted-foreground">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {getSourcePreview(source.content)}
                    </span>
                    <span className="mt-3 flex items-center justify-between font-mono text-[0.6rem] tracking-[0.14em] text-foreground/38 uppercase">
                      <span>{source.type}</span>
                      <span>{counts.words} words</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-[1.1rem] border border-dashed border-border bg-card/50 px-4 py-5 text-sm leading-6 text-muted-foreground">
            No sources yet. Add markdown or pasted text above.
          </div>
        )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-col gap-5 overflow-hidden rounded-[1.75rem] border border-border bg-card/50 p-6 xl:h-full">
        <div className="flex shrink-0 flex-col gap-3 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.18em] uppercase text-brand-accent-foreground">
              {isAddingNew ? 'new source' : 'source editor'}
            </span>
            <h3 className="text-xl font-medium tracking-tight text-foreground">
              {isAddingNew ? 'Add new source' : selectedSource ? selectedSource.title : 'Select a source'}
            </h3>
          </div>
          {selectedSource && !isAddingNew && (
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground">
              <FileText className="size-3.5" />
              {getTextCounts(selectedSource.content ?? '').words} words
            </span>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {isAddingNew ? (
            <ProjectSourceAddForm projectId={projectId} onIngestionTrigger={(sourceId, title, type, content) => { setIsAddingNew(false); ingestionPanelRef.current?.startIngestion(sourceId, title, type, content); }} />
          ) : selectedSource ? (
            <ProjectSourceEditForm key={selectedSource.id} source={selectedSource} onIngestionTrigger={(sourceId, title, type, content) => ingestionPanelRef.current?.startIngestion(sourceId, title, type, content)} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Select a source from the left or add a new one.
            </p>
          )}
        </div>
      </section>

      <aside className="h-[480px] min-w-0 overflow-hidden rounded-[1.35rem] border border-border bg-card xl:h-full">
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
    <div className="flex min-h-full flex-col gap-4">
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
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-transparent px-4 text-xs text-muted-foreground transition hover:border-status-danger-border hover:bg-status-danger-surface hover:text-status-danger-foreground disabled:opacity-50"
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
        <p className="rounded-[1rem] border border-[#e5685b]/30 bg-[#e5685b]/10 px-3 py-2 text-sm text-foreground">
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
  const defaultDraft = content ?? '';
  const [draft, setDraft] = useState(defaultDraft);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const counts = useMemo(() => getTextCounts(draft), [draft]);

  return (
    <form action={action} className="flex flex-1 flex-col gap-4" ref={formRef}>
      {projectId ? <input name="projectId" type="hidden" value={projectId} /> : null}
      {sourceId ? <input name="sourceId" type="hidden" value={sourceId} /> : null}
      <input name="type" type="hidden" value={type === 'text' ? 'text' : 'markdown'} />

      <div className="space-y-2 shrink-0">
        <label className="text-sm font-medium text-muted-foreground" htmlFor={`${sourceId ?? 'new'}-title`}>
          Title
        </label>
        <Input
          className="h-11 rounded-2xl border-border bg-card px-4 text-sm text-foreground placeholder:text-foreground/30 shadow-none focus-visible:border-brand-accent-border/60 focus-visible:ring-[#53d1cb]/20"
          defaultValue={title}
          id={`${sourceId ?? 'new'}-title`}
          name="title"
          placeholder="Chapter excerpt"
          required
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-sm font-medium text-muted-foreground" htmlFor={`${sourceId ?? 'new'}-content`}>
            Content
          </label>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:justify-end">
            <span className="font-mono tabular-nums">{counts.words} words</span>
            <span className="font-mono tabular-nums">{counts.characters} chars</span>
            <div className="flex rounded-full border border-border bg-white/[0.035] p-0.5">
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
            className={`${sourceTextareaVariants({ compact: false })} flex-1 resize-none`}
            id={`${sourceId ?? 'new'}-content`}
            name="content"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Paste notes, textbook excerpts, or markdown here."
            required
            value={draft}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <input name="content" type="hidden" value={draft} />
            <SourcePreview value={draft} />
          </div>
        )}
      </div>

      {error ? (
        <p className="rounded-[1rem] border border-[#e5685b]/30 bg-[#e5685b]/10 px-3 py-2 text-sm text-foreground">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="rounded-[1rem] border border-[#00bb7f]/30 bg-[#00bb7f]/10 px-3 py-2 text-sm text-foreground">
          {success}
        </p>
      ) : null}

      <div className="mt-auto flex shrink-0 items-center gap-3 pt-2">
        <Button
          className="h-9 rounded-full bg-brand-accent px-4 text-[#041018] hover:bg-[#7ceae3]"
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
  const blocks = useMemo(() => {
    return value
      .split(/\n{2,}/)
      .flatMap((block) => {
        const trimmed = block.trim();
        return trimmed ? [{ id: crypto.randomUUID(), text: trimmed }] : [];
      });
  }, [value]);

  if (!blocks.length) {
    return (
      <div className="min-h-[420px] flex-1 rounded-[1.25rem] border border-dashed border-border bg-card/50 p-4 text-sm text-muted-foreground">
        Nothing to preview yet.
      </div>
    );
  }

  return (
    <div className="min-h-[420px] flex-1 overflow-y-auto space-y-4 rounded-[1.25rem] border border-border bg-card p-4 text-sm leading-6 text-muted-foreground shadow-[inset_3px_0_0_rgba(83,209,203,0.58),inset_0_1px_0_rgba(255,255,255,0.04)]">
      {blocks.map((block) => (
        <p className="whitespace-pre-wrap" key={block.id}>
          {block.text}
        </p>
      ))}
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

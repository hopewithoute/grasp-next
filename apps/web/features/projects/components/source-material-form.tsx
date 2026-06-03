'use client';

import {
  useActionState,

  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  addProjectSourceFormAction,
  deleteProjectSourceFormAction,
  updateProjectSourceFormAction,
  addProjectSourceFromUrlFormAction,
} from '../actions';
import { sourceModeButtonVariants, sourceTextareaVariants } from '../project-style-variants';
import { SourceList } from './source-list';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type ProjectSourceItem = {
  content: string | null;
  id: string;
  title: string;
  type: string;
};

type ProjectSourcesPanelProps = {
  projectId: string;
  sources: ProjectSourceItem[];
  onIngestionTrigger: (sourceId: string, title: string, type: string, content: string) => void;
};

export function ProjectSourcesPanel({ projectId, sources, onIngestionTrigger }: ProjectSourcesPanelProps) {
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const selectedSource = !isAddingNew
    ? (sources.find((source) => source.id === selectedSourceId) ?? null)
    : null;

  const isDialogOpen = isAddingNew || selectedSource !== null;

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex-1 overflow-hidden flex flex-col rounded-[1.35rem] border border-border p-4">
        <SourceList
          sources={sources}
          selectedSourceId={selectedSource?.id ?? null}
          onSelectSource={(id) => {
            setSelectedSourceId(id);
            setIsAddingNew(false);
          }}
          onAddNew={() => setIsAddingNew(true)}
        />
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddingNew(false);
            setSelectedSourceId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
          <DialogHeader className="p-4 pb-0 border-b border-border shrink-0 text-left">
            <div className="flex shrink-0 flex-col gap-2 pb-3">
              <div className="space-y-1">
                <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.18em] uppercase text-brand-accent-foreground">
                  {isAddingNew ? 'new source' : 'source editor'}
                </span>
                <DialogTitle className="text-lg font-medium tracking-tight text-foreground truncate">
                  {isAddingNew
                    ? 'Add new source'
                    : selectedSource
                      ? selectedSource.title
                      : 'Source'}
                </DialogTitle>
              </div>
              {selectedSource && !isAddingNew && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-2.5 py-1 text-[0.7rem] text-muted-foreground w-fit">
                  <FileText className="size-3" />
                  {getTextCounts(selectedSource.content ?? '').words} words
                </span>
              )}
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 pt-4">
            {isAddingNew ? (
              <ProjectSourceAddForm
                projectId={projectId}
                onIngestionTrigger={(sourceId, title, type, content) => {
                  setIsAddingNew(false);
                  onIngestionTrigger(sourceId, title, type, content);
                }}
              />
            ) : selectedSource ? (
              <ProjectSourceEditForm
                key={selectedSource.id}
                source={selectedSource}
                onIngestionTrigger={onIngestionTrigger}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectSourceAddForm({
  projectId,
  onIngestionTrigger,
}: {
  projectId: string;
  onIngestionTrigger?: (sourceId: string, title: string, type: string, content: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'text' | 'web'>('text');

  const [state, formAction, isPending] = useActionState(addProjectSourceFormAction, {
    error: null,
    success: false,
  });
  const [urlState, urlFormAction, isUrlPending] = useActionState(addProjectSourceFromUrlFormAction, {
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

  const wrappedUrlAction = (formData: FormData) => {
    submittedValuesRef.current = {
      title: formData.get('title')?.toString() ?? 'Untitled',
      type: 'web',
      content: formData.get('url')?.toString() ?? '', // Just passing URL as content for ingestion trigger
    };
    urlFormAction(formData);
  };

  useLayoutEffect(() => {
    const currentState = activeTab === 'text' ? state : urlState;
    if (currentState.success && currentState.sourceId && currentState.sourceId !== lastSourceIdRef.current) {
      lastSourceIdRef.current = currentState.sourceId;
      const values = submittedValuesRef.current;

      if (values && onIngestionTrigger) {
        onIngestionTrigger(currentState.sourceId, values.title, values.type, currentState.content ?? values.content);
      }
    }
  }, [state.success, state.sourceId, urlState.success, urlState.sourceId, activeTab, onIngestionTrigger, state, urlState]);

  return (
    <div className="flex flex-col flex-1 h-full gap-4">
      <div className="flex gap-2 shrink-0 border-b border-border/50 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('text')}
          className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeTab === 'text' ? 'bg-brand-accent/10 text-brand-accent' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Raw Text / Markdown
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('web')}
          className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeTab === 'web' ? 'bg-brand-accent/10 text-brand-accent' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Web URL
        </button>
      </div>

      {activeTab === 'text' ? (
        <ProjectSourceFields
          action={wrappedAction}
          error={state.error}
          formRef={formRef}
          isPending={isPending}
          projectId={projectId}
          submitLabel="Add source"
          success={state.success ? 'Source added.' : null}
        />
      ) : (
        <ProjectSourceUrlFields
          action={wrappedUrlAction}
          error={urlState.error}
          formRef={formRef}
          isPending={isUrlPending}
          projectId={projectId}
          submitLabel="Fetch from URL"
          success={urlState.success ? 'Web source added.' : null}
        />
      )}
    </div>
  );
}

function ProjectSourceUrlFields({
  action,
  error,
  formRef,
  isPending,
  projectId,
  submitLabel,
  success,
}: {
  action: (payload: FormData) => void;
  error: string | null;
  formRef?: React.RefObject<HTMLFormElement | null>;
  isPending: boolean;
  projectId: string;
  submitLabel: string;
  success: string | null;
}) {
  return (
    <form action={action} className="flex flex-1 flex-col gap-4" ref={formRef}>
      <input name="projectId" type="hidden" value={projectId} />

      <div className="space-y-2 shrink-0">
        <label
          className="text-sm font-medium text-muted-foreground"
          htmlFor="new-url-title"
        >
          Title
        </label>
        <Input
          className="h-11 rounded-2xl border-border bg-card px-4 text-sm text-foreground placeholder:text-foreground/30 shadow-none focus-visible:border-brand-accent-border/60 focus-visible:ring-[#53d1cb]/20"
          id="new-url-title"
          name="title"
          placeholder="e.g. Wikipedia: Quantum Mechanics"
          required
        />
      </div>

      <div className="space-y-2 shrink-0">
        <label
          className="text-sm font-medium text-muted-foreground"
          htmlFor="new-url"
        >
          Web URL
        </label>
        <Input
          className="h-11 rounded-2xl border-border bg-card px-4 text-sm text-foreground placeholder:text-foreground/30 shadow-none focus-visible:border-brand-accent-border/60 focus-visible:ring-[#53d1cb]/20"
          id="new-url"
          name="url"
          type="url"
          placeholder="https://..."
          required
        />
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
          {isPending ? 'Fetching...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function ProjectSourceEditForm({
  source,
  onIngestionTrigger,
}: {
  source: ProjectSourceItem;
  onIngestionTrigger?: (sourceId: string, title: string, type: string, content: string) => void;
}) {
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

  useLayoutEffect(() => {
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
            aria-label="Button"
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
        <label
          className="text-sm font-medium text-muted-foreground"
          htmlFor={`${sourceId ?? 'new'}-title`}
        >
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
          <label
            className="text-sm font-medium text-muted-foreground"
            htmlFor={`${sourceId ?? 'new'}-content`}
          >
            Content
          </label>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:justify-end">
            <span className="font-mono tabular-nums">{counts.words} words</span>
            <span className="font-mono tabular-nums">{counts.characters} chars</span>
            <div className="flex rounded-full border border-border bg-white/[0.035] p-0.5">
              <button
                aria-label="Button"
                className={sourceModeButtonVariants({ active: mode === 'edit' })}
                onClick={() => setMode('edit')}
                type="button"
              >
                Edit
              </button>
              <button
                aria-label="Button"
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
            aria-label="Text field"
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
    return value.split(/\n{2,}/).flatMap((block) => {
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

function getTextCounts(value: string) {
  const trimmed = value.trim();

  return {
    characters: value.length,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
  };
}

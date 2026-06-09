'use client';

import { useActionState, useMemo, useRef, useState, useTransition } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  addProjectSourceFormAction,
  addProjectSourceFromUrlFormAction,
  deleteProjectSourceFormAction,
  updateProjectSourceFormAction,
  type ProjectSourceFormState,
} from '../actions';
import { sourceModeButtonVariants, sourceTextareaVariants } from '../project-style-variants';
import { SourceList } from './source-list';

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

export function ProjectSourcesPanel({
  projectId,
  sources,
  onIngestionTrigger,
}: ProjectSourcesPanelProps) {
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const selectedSource = !isAddingNew
    ? (sources.find((source) => source.id === selectedSourceId) ?? null)
    : null;

  const isDialogOpen = isAddingNew || selectedSource !== null;

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="border-border/40 bg-background/50 flex flex-1 flex-col overflow-hidden rounded-none border p-4">
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
        <DialogContent className="bg-background flex h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[700px]">
          <DialogHeader className="border-border shrink-0 border-b p-4 pb-0 text-left">
            <div className="flex shrink-0 flex-col gap-2 pb-3">
              <div className="space-y-1">
                <span className="text-brand-accent-foreground font-mono text-[0.65rem] tracking-[0.18em] uppercase tabular-nums">
                  [ {isAddingNew ? 'NEW_SOURCE' : 'SOURCE_EDITOR'} ]
                </span>
                <DialogTitle className="text-foreground truncate font-mono text-lg tracking-widest uppercase">
                  {isAddingNew
                    ? 'Add new source'
                    : selectedSource
                      ? selectedSource.title
                      : 'Source'}
                </DialogTitle>
              </div>
              {selectedSource && !isAddingNew && (
                <span className="border-border/40 bg-background/50 text-muted-foreground/70 inline-flex w-fit items-center gap-1.5 rounded-none border px-2.5 py-1 font-mono text-[0.65rem] tracking-widest uppercase">
                  <FileText className="size-3" />
                  {getTextCounts(selectedSource.content ?? '').words} WORDS
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

  const [state, formAction, isPending] = useActionState(
    async (prevState: ProjectSourceFormState, formData: FormData) => {
      const result = await addProjectSourceFormAction(prevState, formData);
      if (result.success && result.sourceId && onIngestionTrigger) {
        onIngestionTrigger(
          result.sourceId,
          formData.get('title')?.toString() ?? 'Untitled',
          formData.get('type')?.toString() ?? 'markdown',
          formData.get('content')?.toString() ?? ''
        );
      }
      return result;
    },
    { error: null, success: false }
  );

  const [urlState, urlFormAction, isUrlPending] = useActionState(
    async (prevState: ProjectSourceFormState, formData: FormData) => {
      const result = await addProjectSourceFromUrlFormAction(prevState, formData);
      if (result.success && result.sourceId && onIngestionTrigger) {
        onIngestionTrigger(
          result.sourceId,
          formData.get('title')?.toString() ?? 'Untitled',
          'web',
          result.content ?? formData.get('url')?.toString() ?? ''
        );
      }
      return result;
    },
    { error: null, success: false }
  );

  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex h-full flex-1 flex-col gap-4">
      <div className="border-border/50 flex shrink-0 gap-2 border-b pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('text')}
          className={`rounded-none px-3 py-1.5 font-mono text-[0.65rem] tracking-widest uppercase transition-colors ${
            activeTab === 'text'
              ? 'bg-brand-accent/20 text-brand-accent border-brand-accent border-b-2'
              : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/30'
          }`}
        >
          [ RAW TEXT / MARKDOWN ]
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('web')}
          className={`rounded-none px-3 py-1.5 font-mono text-[0.65rem] tracking-widest uppercase transition-colors ${
            activeTab === 'web'
              ? 'bg-brand-accent/20 text-brand-accent border-brand-accent border-b-2'
              : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/30'
          }`}
        >
          [ WEB URL ]
        </button>
      </div>

      {activeTab === 'text' ? (
        <ProjectSourceFields
          action={formAction}
          error={state.error}
          formRef={formRef}
          isPending={isPending}
          projectId={projectId}
          submitLabel="Add source"
          success={state.success ? 'Source added.' : null}
        />
      ) : (
        <ProjectSourceUrlFields
          action={urlFormAction}
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

      <div className="shrink-0 space-y-2">
        <label
          className="text-muted-foreground/70 font-mono text-[0.65rem] tracking-widest uppercase"
          htmlFor="new-url-title"
        >
          TITLE
        </label>
        <Input
          className="border-border/40 bg-background/50 text-foreground placeholder:text-muted-foreground/30 focus-visible:border-brand-accent/50 focus-visible:ring-brand-accent/20 h-11 rounded-none px-4 font-mono text-[0.65rem] tracking-widest uppercase shadow-none focus-visible:ring-1"
          id="new-url-title"
          name="title"
          placeholder="E.G. WIKIPEDIA: QUANTUM MECHANICS"
          required
        />
      </div>

      <div className="shrink-0 space-y-2">
        <label
          className="text-muted-foreground/70 font-mono text-[0.65rem] tracking-widest uppercase"
          htmlFor="new-url"
        >
          WEB URL
        </label>
        <Input
          className="border-border/40 bg-background/50 text-foreground placeholder:text-muted-foreground/30 focus-visible:border-brand-accent/50 focus-visible:ring-brand-accent/20 h-11 rounded-none px-4 font-mono text-[0.65rem] tracking-widest uppercase shadow-none focus-visible:ring-1"
          id="new-url"
          name="url"
          type="url"
          placeholder="HTTPS://..."
          required
        />
      </div>

      {error ? (
        <p className="text-foreground border border-[#e5685b]/30 bg-[#e5685b]/10 px-3 py-2 font-mono text-[0.65rem] tracking-widest uppercase">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="text-foreground border border-[#00bb7f]/30 bg-[#00bb7f]/10 px-3 py-2 font-mono text-[0.65rem] tracking-widest uppercase">
          {success}
        </p>
      ) : null}

      <div className="mt-auto flex shrink-0 items-center gap-3 pt-2">
        <Button
          className="bg-brand-accent/20 text-brand-accent hover:bg-brand-accent hover:text-background h-10 rounded-none px-6 font-mono text-[0.65rem] tracking-widest uppercase transition-all"
          disabled={isPending}
          type="submit"
        >
          {isPending ? '[ FETCHING... ]' : `[ ${submitLabel} ]`}
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
  const [state, formAction, isPending] = useActionState(
    async (prevState: ProjectSourceFormState, formData: FormData) => {
      const result = await updateProjectSourceFormAction(prevState, formData);
      if (result.success && result.sourceId && onIngestionTrigger) {
        onIngestionTrigger(
          result.sourceId,
          formData.get('title')?.toString() ?? source.title,
          formData.get('type')?.toString() ?? source.type,
          formData.get('content')?.toString() ?? source.content ?? ''
        );
      }
      return result;
    },
    { error: null, success: false }
  );

  const [deleteState, deleteAction, isDeleting] = useActionState(deleteProjectSourceFormAction, {
    error: null,
    success: false,
  });

  const [, startDeleteTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex min-h-full flex-col gap-4">
      <ProjectSourceFields
        action={formAction}
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
            className="border-border/40 text-muted-foreground/70 hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive inline-flex h-10 items-center gap-1.5 rounded-none border bg-transparent px-4 font-mono text-[0.65rem] tracking-widest uppercase transition-all disabled:opacity-50"
            disabled={isDeleting}
            onClick={() => {
              const formData = new FormData();
              formData.set('sourceId', source.id);
              startDeleteTransition(() => deleteAction(formData));
            }}
            type="button"
          >
            <Trash2 className="size-3.5" />
            {isDeleting ? '[ DELETING... ]' : '[ DELETE ]'}
          </button>
        }
      />
      {deleteState.error ? (
        <p className="text-foreground border border-[#e5685b]/30 bg-[#e5685b]/10 px-3 py-2 font-mono text-[0.65rem] tracking-widest uppercase">
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

      <div className="shrink-0 space-y-2">
        <label
          className="text-muted-foreground/70 font-mono text-[0.65rem] tracking-widest uppercase"
          htmlFor={`${sourceId ?? 'new'}-title`}
        >
          TITLE
        </label>
        <Input
          className="border-border/40 bg-background/50 text-foreground placeholder:text-muted-foreground/30 focus-visible:border-brand-accent/50 focus-visible:ring-brand-accent/20 h-11 rounded-none px-4 font-mono text-[0.65rem] tracking-widest uppercase shadow-none focus-visible:ring-1"
          defaultValue={title}
          id={`${sourceId ?? 'new'}-title`}
          name="title"
          placeholder="CHAPTER EXCERPT"
          required
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label
            className="text-muted-foreground/70 font-mono text-[0.65rem] tracking-widest uppercase"
            htmlFor={`${sourceId ?? 'new'}-content`}
          >
            CONTENT
          </label>
          <div className="text-muted-foreground/70 flex flex-wrap items-center gap-3 font-mono text-[0.65rem] tracking-widest uppercase sm:justify-end">
            <span className="tabular-nums">{counts.words} WORDS</span>
            <span className="tabular-nums">{counts.characters} CHARS</span>
            <div className="border-border/40 bg-muted/20 flex rounded-none border p-0.5">
              <button
                aria-label="Button"
                className={
                  sourceModeButtonVariants({ active: mode === 'edit' }) +
                  ' rounded-none font-mono text-[0.65rem] tracking-widest uppercase'
                }
                onClick={() => setMode('edit')}
                type="button"
              >
                EDIT
              </button>
              <button
                aria-label="Button"
                className={
                  sourceModeButtonVariants({ active: mode === 'preview' }) +
                  ' rounded-none font-mono text-[0.65rem] tracking-widest uppercase'
                }
                onClick={() => setMode('preview')}
                type="button"
              >
                PREVIEW
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
        <p className="text-foreground border border-[#e5685b]/30 bg-[#e5685b]/10 px-3 py-2 font-mono text-[0.65rem] tracking-widest uppercase">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="text-foreground border border-[#00bb7f]/30 bg-[#00bb7f]/10 px-3 py-2 font-mono text-[0.65rem] tracking-widest uppercase">
          {success}
        </p>
      ) : null}

      <div className="mt-auto flex shrink-0 items-center gap-3 pt-2">
        <Button
          className="bg-brand-accent/20 text-brand-accent hover:bg-brand-accent hover:text-background h-10 rounded-none px-6 font-mono text-[0.65rem] tracking-widest uppercase transition-all"
          disabled={isPending}
          type="submit"
        >
          <FileText className="mr-1.5 size-3.5" />
          {isPending ? '[ SAVING... ]' : `[ ${submitLabel} ]`}
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
      <div className="border-border/40 bg-background/50 text-muted-foreground/70 min-h-[420px] flex-1 rounded-none border border-dashed p-4 font-mono text-xs uppercase">
        [ NOTHING TO PREVIEW YET ]
      </div>
    );
  }

  return (
    <div className="border-border/40 bg-background/50 text-foreground min-h-[420px] flex-1 space-y-4 overflow-y-auto rounded-none border p-4 font-mono text-xs leading-6 shadow-[inset_3px_0_0_rgba(83,209,203,0.58),inset_0_1px_0_rgba(255,255,255,0.04)]">
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

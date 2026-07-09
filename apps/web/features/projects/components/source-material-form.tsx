'use client';

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ArrowLeft, File, FileText, Headphones, Link, Trash2, Upload, Video } from 'lucide-react';
import { toast } from 'sonner';
import type { IngestionRunRecord } from '@grasp/domain';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  addProjectSourceFormAction,
  addProjectSourceFromPdfFormAction,
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
  ingestionRuns?: IngestionRunRecord[];
  selectedSourceId?: string | null;
  onSelectSource?: (id: string | null) => void;
  onActivityOpenChange?: (open: boolean) => void;
  onIngestionTrigger?: () => void;
};

export function ProjectSourcesPanel({
  projectId,
  sources,
  ingestionRuns = [],
  onIngestionTrigger,
  selectedSourceId: externalSelectedSourceId,
  onSelectSource: externalOnSelectSource,
  onActivityOpenChange,
}: ProjectSourcesPanelProps) {
  const [internalSelectedSourceId, setInternalSelectedSourceId] = useState<string | null>(null);
  const selectedSourceId =
    externalSelectedSourceId !== undefined ? externalSelectedSourceId : internalSelectedSourceId;
  const setSelectedSourceId = externalOnSelectSource || setInternalSelectedSourceId;

  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const editingSource =
    !isAddingNew && editingSourceId
      ? (sources.find((source) => source.id === editingSourceId) ?? null)
      : null;

  const isDialogOpen = isAddingNew || editingSource !== null;

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="border-border/40 bg-background/50 flex flex-1 flex-col overflow-hidden rounded-none border p-4">
        <SourceList
          projectId={projectId}
          sources={sources}
          ingestionRuns={ingestionRuns}
          selectedSourceId={selectedSourceId ?? null}
          onSelectSource={(id) => {
            setSelectedSourceId(id);
          }}
          onEditSource={(id) => {
            setEditingSourceId(id);
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
            setEditingSourceId(null);
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
                  {isAddingNew ? 'Add new source' : editingSource ? editingSource.title : 'Source'}
                </DialogTitle>
              </div>
              {editingSource && !isAddingNew && (
                <span className="border-border/40 bg-background/50 text-muted-foreground/70 inline-flex w-fit items-center gap-1.5 rounded-none border px-2.5 py-1 font-mono text-[0.65rem] tracking-widest uppercase">
                  <FileText className="size-3" />
                  {getTextCounts(editingSource.content ?? '').words} WORDS
                </span>
              )}
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 pt-4">
            {isAddingNew ? (
              <ProjectSourceAddForm
                projectId={projectId}
                onClose={() => setIsAddingNew(false)}
                onActivityOpenChange={onActivityOpenChange}
              />
            ) : editingSource ? (
              <ProjectSourceEditForm
                key={editingSource.id}
                source={editingSource}
                onClose={() => setEditingSourceId(null)}
                onActivityOpenChange={onActivityOpenChange}
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
  onClose,
  onActivityOpenChange,
}: {
  projectId: string;
  onClose?: () => void;
  onActivityOpenChange?: (open: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<'text' | 'web' | 'pdf' | null>(null);

  const [state, formAction, isPending] = useActionState(
    async (prevState: ProjectSourceFormState, formData: FormData) => {
      const result = await addProjectSourceFormAction(prevState, formData);
      if (result.success && result.sourceId) {
        onClose?.();
        onActivityOpenChange?.(true);
      }
      return result;
    },
    { error: null, success: false }
  );

  const [urlState, urlFormAction, isUrlPending] = useActionState(
    async (prevState: ProjectSourceFormState, formData: FormData) => {
      const result = await addProjectSourceFromUrlFormAction(prevState, formData);
      if (result.success && result.sourceId) {
        onClose?.();
        onActivityOpenChange?.(true);
      }
      return result;
    },
    { error: null, success: false }
  );

  const [pdfState, pdfFormAction, isPdfPending] = useActionState(
    async (prevState: ProjectSourceFormState, formData: FormData) => {
      const result = await addProjectSourceFromPdfFormAction(prevState, formData);
      if (result.success) {
        toast.success('PDF ingestion started.');
        onClose?.();
        onActivityOpenChange?.(true);
      }
      return result;
    },
    { error: null, success: false }
  );

  const formRef = useRef<HTMLFormElement>(null);

  if (!activeTab) {
    return (
      <div className="flex h-full flex-1 flex-col gap-4">
        <p className="text-muted-foreground/70 mb-2 font-mono text-[0.65rem] tracking-widest uppercase">
          SELECT SOURCE TYPE
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { id: 'text', label: 'RAW TEXT', icon: <FileText className="mb-2 size-5" /> },
            { id: 'web', label: 'WEB URL', icon: <Link className="mb-2 size-5" /> },
            { id: 'pdf', label: 'PDF UPLOAD', icon: <File className="mb-2 size-5" /> },
            {
              id: 'youtube',
              label: 'YOUTUBE',
              icon: <Video className="mb-2 size-5 opacity-40" />,
              disabled: true,
            },
            {
              id: 'audio',
              label: 'AUDIO',
              icon: <Headphones className="mb-2 size-5 opacity-40" />,
              disabled: true,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              disabled={tab.disabled}
              onClick={() => setActiveTab(tab.id as any)}
              className={`group border-border/40 hover:border-brand-accent/50 hover:bg-brand-accent/5 bg-background/50 relative flex min-h-24 flex-col items-center justify-center rounded-none border p-4 transition-all duration-300 ${
                tab.disabled
                  ? 'hover:bg-background/50 hover:border-border/40 cursor-not-allowed opacity-50'
                  : 'cursor-pointer hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]'
              }`}
            >
              <div
                className={`transition-transform duration-300 ${!tab.disabled && 'group-hover:text-brand-accent group-hover:scale-110'}`}
              >
                {tab.icon}
              </div>
              <span
                className={`font-mono text-[0.65rem] tracking-widest uppercase ${!tab.disabled && 'group-hover:text-brand-accent transition-colors duration-300'}`}
              >
                {tab.label}
              </span>
              {tab.disabled && (
                <span className="bg-background text-muted-foreground absolute top-2 right-2 border px-1.5 py-0.5 font-mono text-[0.5rem] tracking-widest uppercase">
                  SOON
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 flex h-full flex-1 flex-col gap-4 duration-300">
      <div className="border-border/50 flex shrink-0 items-center gap-2 border-b pb-2">
        <button
          type="button"
          onClick={() => setActiveTab(null)}
          className="text-muted-foreground/70 hover:text-foreground mr-2 inline-flex items-center gap-1.5 font-mono text-[0.65rem] tracking-widest uppercase transition-colors duration-200 hover:-translate-x-1"
        >
          <ArrowLeft className="size-3.5" />
          BACK
        </button>
        <span className="text-brand-accent font-mono text-[0.65rem] tracking-widest uppercase">
          [ {activeTab.toUpperCase()} ]
        </span>
      </div>

      {activeTab === 'text' && (
        <ProjectSourceFields
          action={formAction}
          error={state.error}
          formRef={formRef}
          isPending={isPending}
          projectId={projectId}
          submitLabel="Add source"
          success={state.success ? 'Source added.' : null}
        />
      )}
      {activeTab === 'web' && (
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
      {activeTab === 'pdf' && (
        <ProjectSourcePdfFields
          action={pdfFormAction}
          error={pdfState.error}
          formRef={formRef}
          isPending={isPdfPending}
          projectId={projectId}
          submitLabel="Upload & Ingest PDF"
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
  useEffect(() => {
    if (error) {
      toast.error(error);
    } else if (success) {
      toast.success(success);
    }
  }, [error, success]);

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
  onClose,
  onActivityOpenChange,
}: {
  source: ProjectSourceItem;
  onClose?: () => void;
  onActivityOpenChange?: (open: boolean) => void;
}) {
  const [state, formAction, isPending] = useActionState(
    async (prevState: ProjectSourceFormState, formData: FormData) => {
      const result = await updateProjectSourceFormAction(prevState, formData);
      if (result.success && result.sourceId) {
        onClose?.();
        onActivityOpenChange?.(true);
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

  useEffect(() => {
    if (deleteState.error) {
      toast.error(deleteState.error);
    } else if (deleteState.success) {
      toast.success('Source deleted.');
      onClose?.();
    }
  }, [deleteState.error, deleteState.success, onClose]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 flex h-full flex-1 flex-col gap-4 duration-300">
      <div className="border-border/50 flex shrink-0 items-center justify-between gap-2 border-b pb-2">
        <span className="text-brand-accent font-mono text-[0.65rem] tracking-widest uppercase">
          [ {source.type.toUpperCase()} ]
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground/70 hover:text-foreground inline-flex items-center gap-1.5 font-mono text-[0.65rem] tracking-widest uppercase transition-colors"
        >
          [ DISCARD ]
        </button>
      </div>

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

  useEffect(() => {
    if (error) {
      toast.error(error);
    } else if (success) {
      toast.success(success);
    }
  }, [error, success]);

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

      {type === 'pdf' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <label className="text-muted-foreground/70 font-mono text-[0.65rem] tracking-widest uppercase">
            CONTENT
          </label>
          <div className="border-border/40 bg-muted/10 flex flex-1 flex-col items-center justify-center border p-8 text-center font-mono text-[0.65rem] tracking-widest uppercase">
            <FileText className="text-muted-foreground/50 mb-4 size-8" />
            <p className="text-muted-foreground">PDF Document</p>
            <p className="text-muted-foreground/50 mt-2 max-w-xs leading-relaxed">
              PDF content is ingested automatically and cannot be edited directly from this interface.
            </p>
          </div>
        </div>
      ) : (
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
                  className={sourceModeButtonVariants({ active: mode === 'edit' })}
                  onClick={() => setMode('edit')}
                  type="button"
                >
                  EDIT
                </button>
                <button
                  aria-label="Button"
                  className={sourceModeButtonVariants({ active: mode === 'preview' })}
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
      )}

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

function ProjectSourcePdfFields({
  action,
  error,
  formRef,
  isPending,
  projectId,
  submitLabel,
}: {
  action: (payload: FormData) => void;
  error: string | null;
  formRef?: React.RefObject<HTMLFormElement | null>;
  isPending: boolean;
  projectId: string;
  submitLabel: string;
}) {
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  return (
    <form action={action} className="flex flex-1 flex-col gap-4" ref={formRef}>
      <input name="projectId" type="hidden" value={projectId} />

      <div className="shrink-0 space-y-2">
        <label
          className="text-muted-foreground/70 font-mono text-[0.65rem] tracking-widest uppercase"
          htmlFor="new-pdf-title"
        >
          TITLE (Optional, will use filename if empty)
        </label>
        <Input
          className="border-border/40 bg-background/50 text-foreground placeholder:text-muted-foreground/30 focus-visible:border-brand-accent/50 focus-visible:ring-brand-accent/20 h-11 rounded-none px-4 font-mono text-[0.65rem] tracking-widest uppercase shadow-none focus-visible:ring-1"
          id="new-pdf-title"
          name="title"
          placeholder="E.G. PHYSICS TEXTBOOK CHAPTER 1"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col space-y-2">
        <label
          className="text-muted-foreground/70 font-mono text-[0.65rem] tracking-widest uppercase"
          htmlFor="new-pdf-file"
        >
          PDF FILE
        </label>
        <div className="border-border/40 hover:border-brand-accent/50 hover:bg-brand-accent/5 bg-background/50 relative flex flex-1 flex-col items-center justify-center gap-4 rounded-none border border-dashed p-4 transition-colors">
          <div className="bg-brand-accent/10 flex size-12 items-center justify-center rounded-full">
            <Upload className="text-brand-accent size-5" />
          </div>
          <div className="text-center font-mono text-[0.65rem] tracking-widest uppercase">
            {selectedFilename ? (
              <span className="text-brand-accent">{selectedFilename}</span>
            ) : (
              <span className="text-muted-foreground/70">
                DRAG AND DROP OR <span className="text-brand-accent">CLICK TO BROWSE</span>
              </span>
            )}
          </div>
          <Input
            accept="application/pdf"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            id="new-pdf-file"
            name="file"
            required
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setSelectedFilename(file ? file.name : null);
            }}
          />
        </div>
      </div>

      {error ? (
        <p className="text-foreground border border-[#e5685b]/30 bg-[#e5685b]/10 px-3 py-2 font-mono text-[0.65rem] tracking-widest uppercase">
          {error}
        </p>
      ) : null}

      <div className="mt-auto flex shrink-0 items-center gap-3 pt-2">
        <Button
          className="bg-brand-accent/20 text-brand-accent hover:bg-brand-accent hover:text-background h-10 rounded-none px-6 font-mono text-[0.65rem] tracking-widest uppercase transition-all"
          disabled={isPending}
          type="submit"
        >
          <FileText className="mr-1.5 size-3.5" />
          {isPending ? '[ UPLOADING... ]' : `[ ${submitLabel} ]`}
        </Button>
      </div>
    </form>
  );
}

'use client';

import { useActionState, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { submitSourceMaterialFormAction } from './actions';
import { sourceModeButtonVariants, sourceTextareaVariants } from './project-style-variants';

type SourceMaterialFormProps = {
  compact?: boolean;
  projectId: string;
  sourceMaterial: string | null;
};

export function SourceMaterialForm({
  compact = false,
  projectId,
  sourceMaterial,
}: SourceMaterialFormProps) {
  const [draft, setDraft] = useState(sourceMaterial ?? '');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [state, formAction, isPending] = useActionState(submitSourceMaterialFormAction, {
    error: null,
    success: false,
  });
  const counts = useMemo(() => getTextCounts(draft), [draft]);

  return (
    <form action={formAction} className="space-y-4">
      <input name="projectId" type="hidden" value={projectId} />

      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-sm font-medium" htmlFor="sourceMaterial">
            Source material
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
            className={sourceTextareaVariants({ compact })}
            id="sourceMaterial"
            name="sourceMaterial"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Paste notes, textbook excerpts, or markdown here."
            required
            value={draft}
          />
        ) : (
          <>
            <input name="sourceMaterial" type="hidden" value={draft} />
            <SourcePreview value={draft} />
          </>
        )}
      </div>

      {state.error ? (
        <p className="rounded-[1rem] border border-[#e5685b]/30 bg-[#e5685b]/10 px-3 py-2 text-sm text-[#f3efe3]">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-[1rem] border border-[#00bb7f]/30 bg-[#00bb7f]/10 px-3 py-2 text-sm text-[#f3efe3]">
          Source material saved.
        </p>
      ) : null}

      <Button
        className="h-9 rounded-full bg-[#53d1cb] px-4 text-[#041018] hover:bg-[#7ceae3]"
        disabled={isPending}
        type="submit"
      >
        {isPending ? 'Saving...' : 'Save source'}
      </Button>
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

function getTextCounts(value: string) {
  const trimmed = value.trim();

  return {
    characters: value.length,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
  };
}

'use client';

import { useActionState, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { submitSourceMaterialFormAction } from './actions';

type SourceMaterialFormProps = {
  projectId: string;
  sourceMaterial: string | null;
};

export function SourceMaterialForm({ projectId, sourceMaterial }: SourceMaterialFormProps) {
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
          <div className="flex items-center gap-3 text-xs text-[#5c634f]">
            <span>{counts.words} words</span>
            <span>{counts.characters} chars</span>
            <div className="flex rounded-md border border-[#171916]/15 bg-[#f7f8f4] p-0.5">
              <button
                className={modeButtonClass(mode === 'edit')}
                onClick={() => setMode('edit')}
                type="button"
              >
                Edit
              </button>
              <button
                className={modeButtonClass(mode === 'preview')}
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
            className="min-h-[420px] w-full resize-y rounded-md border border-input bg-white px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
        <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Source material submitted for processing.
        </p>
      ) : null}

      <Button className="h-9" disabled={isPending} type="submit">
        {isPending ? 'Submitting...' : 'Submit source material'}
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
      <div className="min-h-[420px] rounded-md border border-dashed border-[#171916]/20 bg-[#f7f8f4] px-4 py-4 text-sm text-[#5c634f]">
        Nothing to preview yet.
      </div>
    );
  }

  return (
    <div className="min-h-[420px] space-y-4 rounded-md border border-[#171916]/10 bg-[#fbfcf8] px-4 py-4 text-sm leading-6 text-[#242820]">
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

function modeButtonClass(isActive: boolean) {
  return [
    'rounded px-2 py-1 transition-colors',
    isActive ? 'bg-white text-[#171916] shadow-sm' : 'text-[#5c634f]',
  ].join(' ');
}

'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createProjectFormAction } from './actions';

export function CreateProjectForm() {
  const [state, formAction, isPending] = useActionState(createProjectFormAction, { error: null });

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label
          className="font-mono text-[0.65rem] font-medium tracking-[0.18em] text-[#f3efe3]/52 uppercase"
          htmlFor="title"
        >
          Title
        </label>
        <Input
          className="h-12 rounded-2xl border-white/10 bg-[#0d1824] px-4 text-sm text-[#f3efe3] placeholder:text-[#f3efe3]/30 shadow-none focus-visible:border-[#53d1cb]/60 focus-visible:ring-[#53d1cb]/20"
          id="title"
          name="title"
          placeholder="Photosynthesis foundations"
          required
        />
      </div>

      <div className="space-y-2">
        <label
          className="font-mono text-[0.65rem] font-medium tracking-[0.18em] text-[#f3efe3]/52 uppercase"
          htmlFor="description"
        >
          Description
        </label>
        <Input
          className="h-12 rounded-2xl border-white/10 bg-[#0d1824] px-4 text-sm text-[#f3efe3] placeholder:text-[#f3efe3]/30 shadow-none focus-visible:border-[#53d1cb]/60 focus-visible:ring-[#53d1cb]/20"
          id="description"
          name="description"
          placeholder="Grade 10 biology lesson prep"
        />
      </div>

      <div className="space-y-2">
        <label
          className="font-mono text-[0.65rem] font-medium tracking-[0.18em] text-[#f3efe3]/52 uppercase"
          htmlFor="sourceMaterial"
        >
          Source material
        </label>
        <textarea
          className="min-h-40 w-full resize-y rounded-[1.5rem] border border-white/10 bg-[#0d1824] px-4 py-4 text-sm leading-7 text-[#f3efe3] outline-none placeholder:text-[#f3efe3]/30 focus-visible:border-[#53d1cb]/60 focus-visible:ring-3 focus-visible:ring-[#53d1cb]/20"
          id="sourceMaterial"
          name="sourceMaterial"
          placeholder="Paste notes, textbook excerpts, or markdown here."
        />
      </div>

      {state.error ? (
        <div
          className="flex items-start gap-2 rounded-2xl border border-[#e5685b]/30 bg-[#e5685b]/8 px-4 py-3 text-sm text-[#f4a8a0]"
          role="alert"
        >
          <span aria-hidden className="mt-0.5 size-1.5 shrink-0 rounded-full bg-[#e5685b]" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <Button
        className="h-12 w-full rounded-full border border-[#53d1cb]/24 bg-[#53d1cb] text-sm font-medium text-[#041018] transition-all hover:bg-[#7ceae3] active:translate-y-[1px]"
        disabled={isPending}
        type="submit"
      >
        {isPending ? 'Creating…' : 'Create project'}
      </Button>
    </form>
  );
}

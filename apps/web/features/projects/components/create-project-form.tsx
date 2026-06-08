'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createProjectFormAction } from '../actions';

export function CreateProjectForm() {
  const [state, formAction, isPending] = useActionState(createProjectFormAction, { error: null });

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label
          className="text-muted-foreground font-mono text-[0.65rem] font-medium tracking-[0.18em] uppercase"
          htmlFor="title"
        >
          Title
        </label>
        <Input
          className="border-border bg-input text-foreground placeholder:text-muted-foreground/50 focus-visible:border-ring focus-visible:ring-ring/20 h-12 rounded-2xl px-4 text-sm shadow-none"
          id="title"
          name="title"
          placeholder="Photosynthesis foundations"
          required
        />
      </div>

      <div className="space-y-2">
        <label
          className="text-muted-foreground font-mono text-[0.65rem] font-medium tracking-[0.18em] uppercase"
          htmlFor="description"
        >
          Description
        </label>
        <Input
          className="border-border bg-input text-foreground placeholder:text-muted-foreground/50 focus-visible:border-ring focus-visible:ring-ring/20 h-12 rounded-2xl px-4 text-sm shadow-none"
          id="description"
          name="description"
          placeholder="Grade 10 biology lesson prep"
        />
      </div>

      {state.error ? (
        <div
          className="border-status-danger-border bg-status-danger-surface text-status-danger-foreground flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm"
          role="alert"
        >
          <span
            aria-hidden
            className="bg-status-danger-foreground mt-0.5 size-1.5 shrink-0 rounded-full"
          />
          <span>{state.error}</span>
        </div>
      ) : null}

      <Button
        className="border-brand-accent-border bg-brand-accent h-12 w-full rounded-full border text-sm font-medium text-[#041018] transition-all hover:opacity-90 active:translate-y-[1px]"
        disabled={isPending}
        type="submit"
      >
        {isPending ? 'Creating…' : 'Create project'}
      </Button>
    </form>
  );
}

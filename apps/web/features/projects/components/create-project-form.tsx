'use client';

import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createProjectFormAction } from '../actions';

export function CreateProjectForm() {
  const [state, formAction, isPending] = useActionState(createProjectFormAction, { error: null, success: false });

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    } else if (state.success) {
      toast.success('Project initialized successfully.');
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-3">
        <label
          className="text-foreground/80 font-mono text-[0.65rem] tracking-widest uppercase"
          htmlFor="title"
        >
          [ TARGET_DESIGNATION ]
        </label>
        <Input
          className="border-border/50 bg-background text-foreground placeholder:text-muted-foreground/30 focus-visible:border-brand-accent h-12 w-full rounded-none border px-4 font-mono text-sm shadow-none transition-colors outline-none"
          id="title"
          name="title"
          placeholder="e.g. Photosynthesis Foundations"
          required
        />
      </div>

      <div className="space-y-3">
        <label
          className="text-foreground/80 font-mono text-[0.65rem] tracking-widest uppercase"
          htmlFor="description"
        >
          [ PARAMETERS ]
        </label>
        <Input
          className="border-border/50 bg-background text-foreground placeholder:text-muted-foreground/30 focus-visible:border-brand-accent h-12 w-full rounded-none border px-4 font-mono text-sm shadow-none transition-colors outline-none"
          id="description"
          name="description"
          placeholder="e.g. Grade 10 biology lesson prep"
        />
      </div>

      {state.error ? (
        <div
          className="border-status-danger-border bg-status-danger-surface text-status-danger-foreground border px-4 py-3 font-mono text-xs tracking-widest uppercase"
          role="alert"
        >
          [ ERR ] {state.error}
        </div>
      ) : null}

      <div className="pt-2">
        <Button
          className="border-brand-accent/50 bg-brand-accent/10 text-brand-accent hover:bg-brand-accent hover:text-background h-12 w-full rounded-none border font-mono text-xs tracking-widest uppercase transition-all"
          disabled={isPending}
          type="submit"
        >
          {isPending ? '[ INITIALIZING... ]' : '[ INITIALIZE PROJECT ]'}
        </Button>
      </div>
    </form>
  );
}

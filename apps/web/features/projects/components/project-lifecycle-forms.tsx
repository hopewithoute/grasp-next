'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deleteProjectFormAction, updateProjectDetailsFormAction } from '../actions';

type ProjectDetailsFormProps = {
  description: string | null;
  projectId: string;
  title: string;
};

type DeleteProjectFormProps = {
  disabled: boolean;
  projectId: string;
};

export function ProjectDetailsForm({ description, projectId, title }: ProjectDetailsFormProps) {
  const [state, formAction, isPending] = useActionState(updateProjectDetailsFormAction, {
    error: null,
    success: false,
  });

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    } else if (state.success) {
      toast.success('Details synchronized.');
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input name="projectId" type="hidden" value={projectId} />

      <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <div className="space-y-3">
          <label
            className="text-foreground/80 font-mono text-[0.65rem] tracking-widest uppercase"
            htmlFor="projectTitle"
          >
            [ TITLE_NODE ]
          </label>
          <input
            className="border-border/50 bg-background text-foreground placeholder:text-muted-foreground/30 focus-visible:border-brand-accent h-12 w-full border px-4 font-mono text-sm transition-colors outline-none"
            defaultValue={title}
            id="projectTitle"
            maxLength={160}
            name="title"
            aria-label="Project Title"
            required
          />
        </div>

        <div className="space-y-3">
          <label
            className="text-foreground/80 font-mono text-[0.65rem] tracking-widest uppercase"
            htmlFor="projectDescription"
          >
            [ DESC_PARAMETERS ]
          </label>
          <input
            className="border-border/50 bg-background text-foreground placeholder:text-muted-foreground/30 focus-visible:border-brand-accent h-12 w-full border px-4 font-mono text-sm transition-colors outline-none"
            defaultValue={description ?? ''}
            id="projectDescription"
            maxLength={1000}
            name="description"
            aria-label="Project Description"
          />
        </div>
      </div>

      {state.error ? (
        <p className="border-status-danger-border bg-status-danger-surface text-status-danger-foreground border px-4 py-3 font-mono text-xs tracking-widest uppercase">
          [ ERR ] {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="border-status-success-border bg-status-success-surface text-status-success-foreground border px-4 py-3 font-mono text-xs tracking-widest uppercase">
          [ OK ] Details synchronized.
        </p>
      ) : null}

      <div className="pt-2">
        <Button
          className="border-brand-accent/50 bg-background text-brand-accent hover:bg-brand-accent hover:text-background h-10 rounded-none border px-6 font-mono text-xs tracking-widest uppercase transition-all"
          disabled={isPending}
          type="submit"
          variant="outline"
        >
          {isPending ? '[ COMMITTING... ]' : '[ COMMIT CHANGES ]'}
        </Button>
      </div>
    </form>
  );
}

export function DeleteProjectForm({ disabled, projectId }: DeleteProjectFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(deleteProjectFormAction, {
    error: null,
    success: false,
  });

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    } else if (state.success) {
      toast.success('Project purged successfully.');
      router.push('/dashboard/projects');
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-3">
      <input name="projectId" type="hidden" value={projectId} />

      {disabled ? (
        <p className="text-muted-foreground/70 font-mono text-xs leading-7 tracking-wider uppercase">
          &gt; Deletion locked: Active graph build.
        </p>
      ) : null}

      {state.error ? (
        <p className="border-status-danger-border bg-status-danger-surface text-status-danger-foreground border px-4 py-3 font-mono text-xs tracking-widest uppercase">
          [ ERR ] {state.error}
        </p>
      ) : null}

      <Button
        className="border-status-danger-foreground/50 bg-background text-status-danger-foreground hover:bg-status-danger-foreground hover:text-background h-9 rounded-none border px-4 font-mono text-[0.65rem] tracking-widest uppercase transition-all"
        disabled={disabled || isPending}
        type="submit"
        variant="outline"
      >
        {isPending ? '[ PURGING... ]' : '[ PURGE NODE ]'}
      </Button>
    </form>
  );
}

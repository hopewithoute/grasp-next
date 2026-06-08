'use client';

import { useActionState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
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

  return (
    <form action={formAction} className="space-y-4">
      <input name="projectId" type="hidden" value={projectId} />

      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <div className="space-y-2">
          <label className="text-foreground text-sm font-medium" htmlFor="projectTitle">
            Title
          </label>
          <input
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-brand-accent-border focus-visible:ring-brand-accent/20 h-11 w-full rounded-2xl border px-4 text-sm outline-none focus-visible:ring-3"
            defaultValue={title}
            id="projectTitle"
            maxLength={160}
            name="title"
            aria-label="Project Title"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-foreground text-sm font-medium" htmlFor="projectDescription">
            Description
          </label>
          <input
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-brand-accent-border focus-visible:ring-brand-accent/20 h-11 w-full rounded-2xl border px-4 text-sm outline-none focus-visible:ring-3"
            defaultValue={description ?? ''}
            id="projectDescription"
            maxLength={1000}
            name="description"
            aria-label="Project Description"
          />
        </div>
      </div>

      {state.error ? (
        <p className="rounded-2xl border border-red-400/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-2xl border border-emerald-400/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-200">
          Project details updated.
        </p>
      ) : null}

      <Button
        className="bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90 h-10 rounded-full px-5 active:translate-y-[1px]"
        disabled={isPending}
        type="submit"
      >
        <Pencil />
        {isPending ? 'Saving…' : 'Save details'}
      </Button>
    </form>
  );
}

export function DeleteProjectForm({ disabled, projectId }: DeleteProjectFormProps) {
  const [state, formAction, isPending] = useActionState(deleteProjectFormAction, {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-3">
      <input name="projectId" type="hidden" value={projectId} />

      {disabled ? (
        <p className="text-muted-foreground text-sm leading-7">
          Deletion is blocked while a graph build is running.
        </p>
      ) : null}

      {state.error ? (
        <p className="rounded-2xl border border-red-400/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
          {state.error}
        </p>
      ) : null}

      <Button disabled={disabled || isPending} type="submit" variant="destructive">
        <Trash2 />
        {isPending ? 'Deleting...' : 'Delete project'}
      </Button>
    </form>
  );
}

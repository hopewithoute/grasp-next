'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { deleteProjectFormAction, updateProjectDetailsFormAction } from './actions';

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
          <label className="text-sm font-medium text-slate-700" htmlFor="projectTitle">
            Title
          </label>
          <input
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-[#53d1cb] focus-visible:ring-3 focus-visible:ring-[#53d1cb]/20"
            defaultValue={title}
            id="projectTitle"
            maxLength={160}
            name="title"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="projectDescription">
            Description
          </label>
          <input
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-[#53d1cb] focus-visible:ring-3 focus-visible:ring-[#53d1cb]/20"
            defaultValue={description ?? ''}
            id="projectDescription"
            maxLength={1000}
            name="description"
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
        className="h-10 rounded-full bg-[#53d1cb] px-5 text-[#041018] hover:bg-[#7ceae3] active:translate-y-[1px]"
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
        <p className="text-sm leading-7 text-slate-500">
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

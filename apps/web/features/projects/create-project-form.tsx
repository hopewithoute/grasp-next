'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createProjectFormAction } from './actions';

export function CreateProjectForm() {
  const [state, formAction, isPending] = useActionState(createProjectFormAction, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="title">
          Title
        </label>
        <Input id="title" name="title" placeholder="Photosynthesis foundations" required />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="description">
          Description
        </label>
        <Input id="description" name="description" placeholder="Grade 10 biology lesson prep" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="sourceMaterial">
          Source material
        </label>
        <textarea
          className="min-h-36 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          id="sourceMaterial"
          name="sourceMaterial"
          placeholder="Paste notes, textbook excerpts, or markdown here."
        />
      </div>

      {state.error ? (
        <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <Button className="h-9 w-full" disabled={isPending} type="submit">
        {isPending ? 'Creating...' : 'Create project'}
      </Button>
    </form>
  );
}

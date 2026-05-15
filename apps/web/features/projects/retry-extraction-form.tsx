'use client';

import { RotateCcw } from 'lucide-react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { submitSourceMaterialFormAction } from './actions';

type RetryExtractionFormProps = {
  projectId: string;
  sourceMaterial: string;
};

export function RetryExtractionForm({ projectId, sourceMaterial }: RetryExtractionFormProps) {
  const [state, formAction, isPending] = useActionState(submitSourceMaterialFormAction, {
    error: null,
    success: false,
  });

  return (
    <form action={formAction} className="space-y-2">
      <input name="projectId" type="hidden" value={projectId} />
      <input name="sourceMaterial" type="hidden" value={sourceMaterial} />

      <Button disabled={isPending} type="submit" variant="outline">
        <RotateCcw />
        {isPending ? 'Retrying...' : 'Retry extraction'}
      </Button>

      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}

      {state.success ? <p className="text-sm text-green-700">Extraction queued again.</p> : null}
    </form>
  );
}

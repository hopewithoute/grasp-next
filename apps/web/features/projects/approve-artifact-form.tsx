'use client';

import { CheckCircle2 } from 'lucide-react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { approveArtifactFormAction } from './actions';

type ApproveArtifactFormProps = {
  artifactId: string;
  disabled?: boolean;
};

export function ApproveArtifactForm({ artifactId, disabled = false }: ApproveArtifactFormProps) {
  const [state, formAction, isPending] = useActionState(approveArtifactFormAction, {
    error: null,
    success: false,
  });

  return (
    <form action={formAction} className="space-y-2">
      <input name="artifactId" type="hidden" value={artifactId} />
      <Button disabled={disabled || isPending} size="lg" type="submit">
        <CheckCircle2 />
        {isPending ? 'Approving...' : 'Approve concept graph'}
      </Button>

      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}

      {state.success ? <p className="text-sm text-green-700">Concept graph approved.</p> : null}
    </form>
  );
}

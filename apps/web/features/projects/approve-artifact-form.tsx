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
      <Button
        className="h-11 rounded-2xl border border-[#53d1cb]/28 bg-[#53d1cb] px-5 text-[#041018] hover:bg-[#7ceae3]"
        disabled={disabled || isPending}
        size="lg"
        type="submit"
      >
        <CheckCircle2 />
        {isPending ? 'Approving...' : 'Approve concept graph'}
      </Button>

      {state.error ? <p className="text-sm text-red-200">{state.error}</p> : null}

      {state.success ? <p className="text-sm text-emerald-200">Concept graph approved.</p> : null}
    </form>
  );
}

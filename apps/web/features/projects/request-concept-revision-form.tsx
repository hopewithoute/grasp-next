"use client";

import { RotateCcw } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { requestConceptRevisionFormAction } from "./actions";

type RequestConceptRevisionFormProps = {
  artifactId: string;
  disabled?: boolean;
};

export function RequestConceptRevisionForm({
  artifactId,
  disabled = false,
}: RequestConceptRevisionFormProps) {
  const [state, formAction, isPending] = useActionState(
    requestConceptRevisionFormAction,
    { error: null, success: false }
  );

  return (
    <form action={formAction} className="w-full space-y-2">
      <input name="artifactId" type="hidden" value={artifactId} />
      <textarea
        className="min-h-24 w-full resize-y rounded-md border border-[#171916]/15 bg-white px-3 py-2 text-sm leading-6 text-[#171916] outline-none transition focus:border-[#5d7f39] focus:ring-2 focus:ring-[#9db46f]/30 disabled:bg-[#f1f3ec]"
        disabled={disabled || isPending}
        maxLength={4000}
        name="revisionFeedback"
        placeholder="What should change in this concept graph?"
        required
      />
      <Button
        disabled={disabled || isPending}
        size="lg"
        type="submit"
        variant="outline"
      >
        <RotateCcw />
        {isPending ? "Requesting..." : "Request revision"}
      </Button>

      {state.error ? (
        <p className="text-sm text-red-700">{state.error}</p>
      ) : null}

      {state.success ? (
        <p className="text-sm text-green-700">Revision requested.</p>
      ) : null}
    </form>
  );
}

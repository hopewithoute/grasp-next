"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  deleteProjectFormAction,
  updateProjectDetailsFormAction,
} from "./actions";

type ProjectDetailsFormProps = {
  description: string | null;
  projectId: string;
  title: string;
};

type DeleteProjectFormProps = {
  disabled: boolean;
  projectId: string;
};

export function ProjectDetailsForm({
  description,
  projectId,
  title,
}: ProjectDetailsFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateProjectDetailsFormAction,
    { error: null, success: false }
  );

  return (
    <form action={formAction} className="space-y-4">
      <input name="projectId" type="hidden" value={projectId} />

      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="projectTitle">
            Title
          </label>
          <input
            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            defaultValue={title}
            id="projectTitle"
            maxLength={160}
            name="title"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="projectDescription">
            Description
          </label>
          <input
            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            defaultValue={description ?? ""}
            id="projectDescription"
            maxLength={1000}
            name="description"
          />
        </div>
      </div>

      {state.error ? (
        <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Project details updated.
        </p>
      ) : null}

      <Button className="h-9" disabled={isPending} type="submit">
        <Pencil />
        {isPending ? "Saving..." : "Save details"}
      </Button>
    </form>
  );
}

export function DeleteProjectForm({
  disabled,
  projectId,
}: DeleteProjectFormProps) {
  const [state, formAction, isPending] = useActionState(deleteProjectFormAction, {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-3">
      <input name="projectId" type="hidden" value={projectId} />

      {disabled ? (
        <p className="text-sm leading-6 text-[#5c634f]">
          Deletion is blocked while extraction is processing.
        </p>
      ) : null}

      {state.error ? (
        <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <Button disabled={disabled || isPending} type="submit" variant="destructive">
        <Trash2 />
        {isPending ? "Deleting..." : "Delete project"}
      </Button>
    </form>
  );
}

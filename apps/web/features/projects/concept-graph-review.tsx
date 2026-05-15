"use client";

import { ApproveArtifactForm } from "./approve-artifact-form";
import {
  ConceptGraphView,
  type ConceptGraphArtifact,
  type ConceptRow,
  type RelationshipRow,
} from "./concept-graph-view";
import { RequestConceptRevisionForm } from "./request-concept-revision-form";

type ConceptGraphReviewProps = {
  artifact: ConceptGraphArtifact;
  concepts: ConceptRow[];
  relationships: RelationshipRow[];
};

export function ConceptGraphReview({
  artifact,
  concepts,
  relationships,
}: ConceptGraphReviewProps) {
  const canApprove =
    artifact?.status === "generated" || artifact?.status === "needs_revision";
  const canRequestRevision = artifact?.status === "generated";

  return (
    <section className="space-y-5 rounded-md border border-[#171916]/15 bg-[#fbfcf8] p-5 shadow-[6px_6px_0_#c8d8e8]">
      <div className="flex flex-col gap-4 border-b border-[#171916]/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-[0.24em] text-[#5c634f] uppercase">
            Concept review
          </p>
          <h2 className="text-xl font-semibold">Generated concept graph</h2>
          <p className="max-w-2xl text-sm leading-6 text-[#5c634f]">
            Review the extracted concepts, evidence excerpts, and prerequisite
            links before allowing downstream lesson generation.
          </p>
        </div>

        {artifact ? (
          <div className="flex w-full flex-col items-start gap-3 lg:w-80 lg:items-end">
            <span className={artifactStatusClass(artifact.status)}>
              {artifact.status.replace("_", " ")}
            </span>
            <ApproveArtifactForm
              artifactId={artifact.id}
              disabled={!canApprove}
            />
            <RequestConceptRevisionForm
              artifactId={artifact.id}
              disabled={!canRequestRevision}
            />
          </div>
        ) : null}
      </div>

      <ConceptGraphView
        artifact={artifact}
        concepts={concepts}
        relationships={relationships}
      />
    </section>
  );
}

function artifactStatusClass(status: string) {
  const classByStatus: Record<string, string> = {
    approved: "bg-green-50 text-green-700",
    failed: "bg-red-50 text-red-700",
    generated: "bg-blue-50 text-blue-700",
    generating: "bg-amber-50 text-amber-700",
    needs_revision: "bg-orange-50 text-orange-700",
    pending: "bg-[#ecefe5] text-[#4f5a45]",
    published: "bg-green-50 text-green-700",
    rejected: "bg-red-50 text-red-700",
  };

  return [
    "rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
    classByStatus[status] ?? "bg-[#ecefe5] text-[#4f5a45]",
  ].join(" ");
}

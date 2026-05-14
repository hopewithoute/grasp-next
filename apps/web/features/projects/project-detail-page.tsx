import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActor } from "@/server/actor";
import { createProjectDeps } from "@/server/project-deps";
import { ApproveArtifactForm } from "./approve-artifact-form";
import { ProjectStatusBadge } from "./project-status-badge";
import { RequestConceptRevisionForm } from "./request-concept-revision-form";
import { SourceMaterialForm } from "./source-material-form";

type ProjectDetailPageProps = {
  projectId: string;
};

export async function ProjectDetailPage({ projectId }: ProjectDetailPageProps) {
  const actor = await getActor();

  if (!actor) {
    redirect("/sign-in");
  }

  const deps = createProjectDeps();
  const project = await deps.projectRepository.findByIdForOwner(projectId, actor.id);

  if (!project) {
    notFound();
  }

  const [{ concepts, relationships }, conceptGraphArtifact] = await Promise.all([
    deps.conceptRepository.listByProject(project.id),
    deps.artifactRepository.findByProjectAndType(project.id, "concept_graph"),
  ]);

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-6 py-8 text-[#171916]">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-5 border-b border-[#171916]/15 pb-6">
          <Link
            className="text-sm font-medium text-[#5c634f] hover:text-[#171916]"
            href="/dashboard/projects"
          >
            Back to projects
          </Link>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.24em] text-[#5c634f] uppercase">
                Source material
              </p>
              <h1 className="text-3xl font-semibold">{project.title}</h1>
              {project.description ? (
                <p className="max-w-2xl text-sm leading-6 text-[#5c634f]">
                  {project.description}
                </p>
              ) : null}
            </div>
            <ProjectStatusBadge status={project.status} />
          </div>
        </header>

        <section className="rounded-md border border-[#171916]/15 bg-white p-5 shadow-[6px_6px_0_#d7e0bf]">
          <SourceMaterialForm
            projectId={project.id}
            sourceMaterial={project.sourceMaterial}
          />
        </section>

        <ConceptReviewSection
          artifact={conceptGraphArtifact}
          concepts={concepts}
          relationships={relationships}
        />
      </div>
    </main>
  );
}

type ConceptRow = {
  confidence: string;
  definition: string;
  difficulty: "advanced" | "beginner" | "intermediate";
  id: string;
  name: string;
  sourceEvidence: unknown;
};

type RelationshipRow = {
  id: string;
  relationshipType: string;
  sourceConceptId: string;
  targetConceptId: string;
};

type ConceptGraphArtifact = {
  id: string;
  status: string;
} | null;

function ConceptReviewSection({
  artifact,
  concepts,
  relationships,
}: {
  artifact: ConceptGraphArtifact;
  concepts: ConceptRow[];
  relationships: RelationshipRow[];
}) {
  const conceptNameById = new Map(
    concepts.map((concept) => [concept.id, concept.name])
  );
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
          <div className="flex flex-col items-start gap-3 lg:items-end">
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

      {!concepts.length ? (
        <div className="rounded-md border border-dashed border-[#171916]/20 bg-white px-4 py-8 text-sm text-[#5c634f]">
          No concept graph has been generated yet.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            {concepts.map((concept) => (
              <article
                className="rounded-md border border-[#171916]/10 bg-white p-4"
                key={concept.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold">{concept.name}</h3>
                    <p className="text-sm leading-6 text-[#3b4035]">
                      {concept.definition}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={difficultyClass(concept.difficulty)}>
                      {concept.difficulty}
                    </span>
                    <span className="rounded-full bg-[#f1f3ec] px-2 py-1 text-xs font-medium text-[#4f5a45]">
                      {formatConfidence(concept.confidence)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {getEvidence(concept.sourceEvidence).map((evidence, index) => (
                    <blockquote
                      className="border-l-2 border-[#9db46f] bg-[#f7f8f4] px-3 py-2 text-sm leading-6 text-[#4a513f]"
                      key={`${concept.id}-${index}`}
                    >
                      {evidence.excerpt}
                      {evidence.location ? (
                        <cite className="mt-1 block text-xs not-italic text-[#6a725f]">
                          {evidence.location}
                        </cite>
                      ) : null}
                    </blockquote>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <aside className="rounded-md border border-[#171916]/10 bg-white p-4">
            <h3 className="text-sm font-semibold">Prerequisites</h3>
            {relationships.length ? (
              <ul className="mt-3 space-y-2">
                {relationships.map((relationship) => (
                  <li
                    className="rounded border border-[#171916]/10 bg-[#f7f8f4] px-3 py-2 text-sm text-[#3b4035]"
                    key={relationship.id}
                  >
                    {conceptNameById.get(relationship.sourceConceptId) ??
                      "Unknown concept"}{" "}
                    <span className="text-[#7a846d]">before</span>{" "}
                    {conceptNameById.get(relationship.targetConceptId) ??
                      "Unknown concept"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[#5c634f]">
                No prerequisite links were generated. This graph can still be
                reviewed as a flat concept list.
              </p>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

type SourceEvidence = {
  excerpt: string;
  location?: string;
};

function getEvidence(value: unknown): SourceEvidence[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is SourceEvidence => {
    return (
      typeof item === "object" &&
      item !== null &&
      "excerpt" in item &&
      typeof item.excerpt === "string" &&
      item.excerpt.trim().length > 0
    );
  });
}

function formatConfidence(value: string) {
  const confidence = Number(value);

  if (!Number.isFinite(confidence)) {
    return "confidence n/a";
  }

  return `${Math.round(confidence * 100)}%`;
}

function difficultyClass(difficulty: ConceptRow["difficulty"]) {
  const classByDifficulty = {
    advanced: "bg-[#f9e8e2] text-[#9d4c32]",
    beginner: "bg-[#e9f3df] text-[#4d7135]",
    intermediate: "bg-[#e7eef8] text-[#315f94]",
  };

  return [
    "rounded-full px-2 py-1 text-xs font-medium capitalize",
    classByDifficulty[difficulty],
  ].join(" ");
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

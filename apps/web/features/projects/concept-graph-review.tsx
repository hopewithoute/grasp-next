'use client';
import {
  ConceptGraphView,
  type ConceptGraphArtifact,
  type ConceptRow,
  type RelationshipRow,
} from './concept-graph-view';
import { artifactStatusVariant } from './project-style-variants';

type ConceptGraphReviewProps = {
  artifact: ConceptGraphArtifact;
  concepts: ConceptRow[];
  relationships: RelationshipRow[];
};

export function ConceptGraphReview({ artifact, concepts, relationships }: ConceptGraphReviewProps) {
  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
            Graph Explorer
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">Generated Concept Graph</p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Review extracted concepts, evidence, and relationship links before moving the lesson
            workflow forward.
          </p>
        </div>

        {artifact ? (
          <div className="flex w-full flex-col items-start gap-3 lg:w-80 lg:items-end">
            <span className={artifactStatusVariant(artifact.status)}>
              {artifact.status.replace('_', ' ')}
            </span>
          </div>
        ) : null}
      </div>

      <ConceptGraphView artifact={artifact} concepts={concepts} relationships={relationships} />
    </section>
  );
}

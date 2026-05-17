import type { ArtifactRepository, ArtifactReviewRunRepository } from '../artifacts/artifact.types';
import type { ExtractionMode } from '../constants';
import type { ConceptRepository } from '../concepts/concept.types';
import type { ExtractedConceptGraphDto } from '../concepts/concept.dto';
import type { AuditLogRepository, ProjectRepository } from '../projects/project.types';

export type ConceptExtractionWorkflowResult = {
  conceptGraph: ExtractedConceptGraphDto;
  extractionMode: ExtractionMode;
  workflowRunId: string;
  suspendedSteps: unknown;
  resumeLabels: unknown | null;
};

export type ConceptExtractionWorkflow = {
  runAndSuspend(input: {
    sourceMaterial: string;
    projectId: string;
  }): Promise<ConceptExtractionWorkflowResult>;
};

export type ProcessConceptExtractionDeps = {
  artifactRepository: ArtifactRepository;
  artifactReviewRunRepository: ArtifactReviewRunRepository;
  auditLogRepository: AuditLogRepository;
  conceptRepository: ConceptRepository;
  projectRepository: ProjectRepository;
  conceptExtractionWorkflow: ConceptExtractionWorkflow;
};

export type ProcessConceptExtractionResult = {
  artifactId: string;
  artifactVersionId: string;
  reviewRunId: string;
  conceptCount: number;
  relationshipCount: number;
  extractionMode: ExtractionMode;
};

import { z } from 'zod';
import { ARTIFACT_TYPE } from '../constants';
import type { ConceptRepository } from '../concepts/concept.types';
import type { ConceptDifficultyDto } from '../concepts/concept.dto';
import type { ArtifactRecord, ArtifactRepository } from '../artifacts/artifact.types';
import type { ProjectRecord, ProjectRepository } from './project.types';
import { ProjectNotFoundError } from './submit-source-material.action';

export const loadProjectDetailDto = z.object({
  projectId: z.uuid(),
  ownerId: z.string().trim().min(1),
});

export type LoadProjectDetailInput = z.infer<typeof loadProjectDetailDto>;

export type LoadProjectDetailDeps = {
  artifactRepository: ArtifactRepository;
  conceptRepository: ConceptRepository;
  projectRepository: ProjectRepository;
};

export type LoadProjectDetailResult = {
  project: ProjectRecord;
  concepts: Array<{
    id: string;
    name: string;
    definition: string;
    difficulty: ConceptDifficultyDto;
    confidence: string;
    sourceEvidence: unknown;
  }>;
  relationships: Array<{
    id: string;
    sourceConceptId: string;
    targetConceptId: string;
    relationshipType: string;
  }>;
  conceptGraphArtifact: ArtifactRecord | null;
};

export async function loadProjectDetail(
  input: LoadProjectDetailInput,
  deps: LoadProjectDetailDeps
): Promise<LoadProjectDetailResult> {
  const dto = loadProjectDetailDto.parse(input);

  const project = await deps.projectRepository.findByIdForOwner(dto.projectId, dto.ownerId);

  if (!project) {
    throw new ProjectNotFoundError();
  }

  const [{ concepts, relationships }, conceptGraphArtifact] = await Promise.all([
    deps.conceptRepository.listByProject(project.id),
    deps.artifactRepository.findByProjectAndType(project.id, ARTIFACT_TYPE.CONCEPT_GRAPH),
  ]);

  return {
    project,
    concepts,
    relationships,
    conceptGraphArtifact,
  };
}

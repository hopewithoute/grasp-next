import type { ConceptDifficultyDto } from '../concepts/concept.dto';
import type { IngestionRunRecord, IngestionRunRepository } from '../knowledgebase';
import type { ProjectSourceRecord, ProjectSourceRepository } from '../project-sources';
import { ProjectNotFoundError } from './project.errors';
import type { ProjectRecord, ProjectRepository } from './project.types';

export type LoadProjectDetailInput = {
  projectId: string;
  ownerId: string;
};

export type LoadProjectDetailDeps = {
  fetchIngestionRuns?: (projectId: string, ownerId: string) => Promise<IngestionRunRecord[]>;
  projectRepository: ProjectRepository;
  projectSourceRepository: ProjectSourceRepository;
};

export type KnowledgebaseGraphConceptReadModel = {
  id: string;
  name: string;
  definition: string;
  difficulty: ConceptDifficultyDto;
  confidence: string;
  sourceEvidence?: unknown;
  evidenceCount?: number;
};

export type KnowledgebaseGraphRelationshipReadModel = {
  id: string;
  sourceEvidence?: unknown;
  sourceConceptId: string;
  targetConceptId: string;
  relationshipType: string;
};

export type KnowledgebaseGraphReadModel = {
  source: 'none' | 'relational_projection' | 'lgs';
  concepts: KnowledgebaseGraphConceptReadModel[];
  relationships: KnowledgebaseGraphRelationshipReadModel[];
};

export type LoadProjectDetailResult = {
  project: ProjectRecord;
  knowledgebaseGraph: KnowledgebaseGraphReadModel;
  latestIngestionRun: IngestionRunRecord | null;
  ingestionRuns: IngestionRunRecord[];
  concepts: KnowledgebaseGraphConceptReadModel[];
  relationships: KnowledgebaseGraphRelationshipReadModel[];
  sources: ProjectSourceRecord[];
};

export async function loadProjectDetail(
  input: LoadProjectDetailInput,
  deps: LoadProjectDetailDeps
): Promise<LoadProjectDetailResult> {
  const project = await deps.projectRepository.findByIdForOwner(input.projectId, input.ownerId);

  if (!project) {
    throw new ProjectNotFoundError();
  }

  const [ingestionRuns, sources] = await Promise.all([
    deps.fetchIngestionRuns?.(project.id, input.ownerId) ?? Promise.resolve([]),
    deps.projectSourceRepository.listByProjectForOwner(project.id, input.ownerId),
  ]);

  const latestIngestionRun = ingestionRuns.length > 0 ? ingestionRuns[0] : null;

  const conceptReadModel = emptyKnowledgebaseReadModel();

  return {
    project,
    knowledgebaseGraph: conceptReadModel,
    latestIngestionRun,
    ingestionRuns,
    concepts: conceptReadModel.concepts,
    relationships: conceptReadModel.relationships,
    sources,
  };
}

function emptyKnowledgebaseReadModel(): KnowledgebaseGraphReadModel {
  return {
    concepts: [],
    relationships: [],
    source: 'none',
  };
}

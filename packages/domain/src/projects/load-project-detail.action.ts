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
  ingestionRunRepository?: IngestionRunRepository;
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

  const [latestIngestionRun, sources] = await Promise.all([
    deps.ingestionRunRepository?.findLatestByProject(project.id) ?? Promise.resolve(null),
    deps.projectSourceRepository.listByProject(project.id),
  ]);
  const hasUsableSource = sources.some((source) => source.content?.trim());
  const _graphIsCurrentForSources =
    hasUsableSource && isIngestionCurrentForSources(latestIngestionRun, sources);

  const conceptReadModel = emptyKnowledgebaseReadModel();

  return {
    project,
    knowledgebaseGraph: conceptReadModel,
    latestIngestionRun,
    concepts: conceptReadModel.concepts,
    relationships: conceptReadModel.relationships,
    sources,
  };
}

function isIngestionCurrentForSources(
  latestIngestionRun: IngestionRunRecord | null,
  sources: ProjectSourceRecord[]
) {
  if (latestIngestionRun?.status !== 'completed') {
    return false;
  }

  const completedAt = latestIngestionRun.completedAt ?? latestIngestionRun.updatedAt;
  const latestSourceUpdatedAt = sources.reduce<Date | null>((latest, source) => {
    if (!source.content?.trim()) {
      return latest;
    }

    return !latest || source.updatedAt > latest ? source.updatedAt : latest;
  }, null);

  return latestSourceUpdatedAt ? completedAt >= latestSourceUpdatedAt : false;
}

function emptyKnowledgebaseReadModel(): KnowledgebaseGraphReadModel {
  return {
    concepts: [],
    relationships: [],
    source: 'none',
  };
}

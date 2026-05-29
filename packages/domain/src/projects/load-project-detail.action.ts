import { z } from 'zod';
import type { ConceptDifficultyDto } from '../concepts/concept.dto';
import type {
  IngestionRunRecord,
  IngestionRunRepository,
  KnowledgebaseRepository,
} from '../knowledgebase';
import type { ProjectSourceRecord, ProjectSourceRepository } from '../project-sources';
import type { ProjectRecord, ProjectRepository } from './project.types';
import { ProjectNotFoundError } from './project.errors';

export const loadProjectDetailDto = z.object({
  projectId: z.uuid(),
  ownerId: z.string().trim().min(1),
});

export type LoadProjectDetailInput = z.infer<typeof loadProjectDetailDto>;

export type LoadProjectDetailDeps = {
  ingestionRunRepository?: IngestionRunRepository;
  knowledgebaseRepository?: KnowledgebaseRepository;
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
  source: 'none' | 'relational_projection';
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
  const dto = loadProjectDetailDto.parse(input);

  const project = await deps.projectRepository.findByIdForOwner(dto.projectId, dto.ownerId);

  if (!project) {
    throw new ProjectNotFoundError();
  }

  const [latestIngestionRun, sources] = await Promise.all([
    deps.ingestionRunRepository?.findLatestByProject(project.id) ?? Promise.resolve(null),
    deps.projectSourceRepository.listByProject(project.id),
  ]);
  const hasUsableSource = sources.some((source) => source.content?.trim());
  const graphIsCurrentForSources =
    hasUsableSource && isIngestionCurrentForSources(latestIngestionRun, sources);

  const relationalReadModel = deps.knowledgebaseRepository
    ? graphIsCurrentForSources
      ? await deps.knowledgebaseRepository.findCurrentGraphByProject(project.id)
      : null
    : null;

  const conceptReadModel = relationalReadModel
    ? {
        ...relationalReadModel,
        source: 'relational_projection' as const,
      }
    : emptyKnowledgebaseReadModel();

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

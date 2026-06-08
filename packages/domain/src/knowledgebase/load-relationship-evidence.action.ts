import type { KnowledgebaseRepository } from './knowledgebase.types';

export type LoadRelationshipEvidenceInput = {
  relationshipId: string;
  projectId: string;
  ownerId: string;
};

export type LoadRelationshipEvidenceDeps = {
  knowledgebaseRepository: KnowledgebaseRepository;
};

export async function loadRelationshipEvidence(
  input: LoadRelationshipEvidenceInput,
  deps: LoadRelationshipEvidenceDeps
) {
  const evidence = await deps.knowledgebaseRepository.findRelationshipEvidence({
    projectId: input.projectId,
    relationshipKey: input.relationshipId,
  });

  return evidence;
}

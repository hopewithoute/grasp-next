import { z } from 'zod';
import type { KnowledgebaseRepository } from './knowledgebase.types';

export const loadRelationshipEvidenceDto = z.object({
  relationshipId: z.string().min(1),
  projectId: z.string().min(1), // project id for auth check if needed later
  ownerId: z.string().min(1),
});

export type LoadRelationshipEvidenceInput = z.infer<typeof loadRelationshipEvidenceDto>;

export type LoadRelationshipEvidenceDeps = {
  knowledgebaseRepository: KnowledgebaseRepository;
};

export async function loadRelationshipEvidence(
  input: LoadRelationshipEvidenceInput,
  deps: LoadRelationshipEvidenceDeps
) {
  const dto = loadRelationshipEvidenceDto.parse(input);

  const evidence = await deps.knowledgebaseRepository.findRelationshipEvidence({
    projectId: dto.projectId,
    relationshipKey: dto.relationshipId,
  });

  return evidence;
}

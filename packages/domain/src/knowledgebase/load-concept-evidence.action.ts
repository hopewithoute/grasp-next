import { z } from 'zod';
import type { KnowledgebaseRepository } from './knowledgebase.types';

export const loadConceptEvidenceDto = z.object({
  conceptId: z.string().min(1),
  projectId: z.string().min(1), // project id for auth check if needed later, right now graph uses it
  ownerId: z.string().min(1),
});

export type LoadConceptEvidenceInput = z.infer<typeof loadConceptEvidenceDto>;

export type LoadConceptEvidenceDeps = {
  knowledgebaseRepository: KnowledgebaseRepository;
};

export async function loadConceptEvidence(
  input: LoadConceptEvidenceInput,
  deps: LoadConceptEvidenceDeps
) {
  const dto = loadConceptEvidenceDto.parse(input);

  const evidence = await deps.knowledgebaseRepository.findConceptEvidence({
    conceptKey: dto.conceptId,
    projectId: dto.projectId,
  });

  return evidence;
}

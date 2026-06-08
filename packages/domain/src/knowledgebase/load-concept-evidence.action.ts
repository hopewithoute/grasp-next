import type { KnowledgebaseRepository } from './knowledgebase.types';

export type LoadConceptEvidenceInput = {
  conceptId: string;
  projectId: string;
  ownerId: string;
};

export type LoadConceptEvidenceDeps = {
  knowledgebaseRepository: KnowledgebaseRepository;
};

export async function loadConceptEvidence(
  input: LoadConceptEvidenceInput,
  deps: LoadConceptEvidenceDeps
) {
  const evidence = await deps.knowledgebaseRepository.findConceptEvidence({
    conceptKey: input.conceptId,
    projectId: input.projectId,
  });

  return evidence;
}

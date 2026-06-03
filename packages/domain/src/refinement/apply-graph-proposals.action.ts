import {
  addConceptProposalDto,
  updateConceptProposalDto,
  deleteConceptProposalDto,
  addRelationshipProposalDto,
  deleteRelationshipProposalDto,
  addEvidenceProposalDto,
  updateEvidenceProposalDto,
  deleteEvidenceProposalDto,
} from './proposal.dto';
import type { KnowledgebaseRepository } from '../knowledgebase/knowledgebase.types';

export type GraphProposalAction = {
  type: string;
  payload: Record<string, unknown>;
};

export type ApplyGraphProposalsInput = {
  projectId: string;
  actions: GraphProposalAction[];
};

export type ApplyGraphProposalsDeps = {
  knowledgebaseRepository: KnowledgebaseRepository;
};

export type ApplyGraphProposalsResult = {
  success: boolean;
  applied: number;
};

/**
 * Pure domain function: applies a batch of graph proposal actions to the
 * knowledgebase repository. Returns the count of applied actions.
 *
 * Extracted from the server-action switch statement so it can be tested
 * without Next.js server-action context.
 */
export async function applyGraphProposals(
  input: ApplyGraphProposalsInput,
  deps: ApplyGraphProposalsDeps
): Promise<ApplyGraphProposalsResult> {
  const { projectId, actions } = input;
  const { knowledgebaseRepository } = deps;

  for (const action of actions) {
    switch (action.type) {
      case 'add_concept': {
        const payload = addConceptProposalDto.parse(action.payload);
        const metadata = payload.metadata ? { ...payload.metadata, isUserEdited: true } : { isUserEdited: true };
        await knowledgebaseRepository.addConcept({ projectId, ...payload, metadata });
        break;
      }
      case 'update_concept': {
        const payload = updateConceptProposalDto.parse(action.payload);
        const metadata = payload.metadata ? { ...payload.metadata, isUserEdited: true } : { isUserEdited: true };
        await knowledgebaseRepository.updateConcept({ projectId, ...payload, metadata });
        break;
      }
      case 'delete_concept': {
        const payload = deleteConceptProposalDto.parse(action.payload);
        await knowledgebaseRepository.tombstoneConcept({
          projectId,
          conceptKey: payload.conceptKey,
        });
        break;
      }
      case 'add_relationship': {
        const payload = addRelationshipProposalDto.parse(action.payload);
        await knowledgebaseRepository.addRelationship({
          projectId,
          relationshipKey: `${payload.sourceConceptKey}:${payload.targetConceptKey}:${payload.relationshipType}`,
          ...payload,
        });
        break;
      }
      case 'delete_relationship': {
        const payload = deleteRelationshipProposalDto.parse(action.payload);
        await knowledgebaseRepository.deleteRelationship({
          projectId,
          relationshipKey: `${payload.sourceConceptKey}:${payload.targetConceptKey}:${payload.relationshipType}`,
        });
        break;
      }
      case 'add_evidence': {
        const payload = addEvidenceProposalDto.parse(action.payload);
        await knowledgebaseRepository.addConceptEvidence({
          projectId,
          conceptKey: payload.conceptKey,
          sourceType: payload.sourceType === 'text' ? 'text' : 'web',
          title: payload.title || 'Agent Search Result',
          url: payload.url,
          quote: payload.evidenceText,
          locationLabel: 'AI Extracted',
        });
        break;
      }
      case 'update_evidence': {
        const payload = updateEvidenceProposalDto.parse(action.payload);
        await knowledgebaseRepository.updateConceptEvidence({
          projectId,
          evidenceId: payload.evidenceId,
          quote: payload.evidenceText,
        });
        break;
      }
      case 'delete_evidence': {
        const payload = deleteEvidenceProposalDto.parse(action.payload);
        await knowledgebaseRepository.deleteConceptEvidence({
          projectId,
          evidenceId: payload.evidenceId,
        });
        break;
      }
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  await knowledgebaseRepository.createSnapshot({
    projectId,
    trigger: 'agent_refinement_proposal_approval',
  });

  return { success: true, applied: actions.length };
}

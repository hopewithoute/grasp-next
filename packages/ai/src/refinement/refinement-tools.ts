import type { KnowledgebaseRepository } from '@grasp/domain';
import {
  AddConceptSchema,
  AddEvidenceSchema,
  AddRelationshipSchema,
  createProposeGraphChangesTool,
  createSearchWikiConceptsTool,
  DeleteConceptSchema,
  DeleteEvidenceSchema,
  DeleteRelationshipSchema,
  GraphProposalActionSchema,
  GraphProposalSchema,
  UpdateConceptSchema,
  UpdateEvidenceSchema,
  type GraphProposalAction,
  type GraphProposalPayload,
} from './graph-tools';
import { createProposeWebSourceTool, createSearchWebTool } from './web-tools';

// Re-export schemas and types from graph-tools for backward compatibility
export {
  AddConceptSchema,
  UpdateConceptSchema,
  DeleteConceptSchema,
  AddRelationshipSchema,
  DeleteRelationshipSchema,
  AddEvidenceSchema,
  UpdateEvidenceSchema,
  DeleteEvidenceSchema,
  GraphProposalActionSchema,
  GraphProposalSchema,
  type GraphProposalAction,
  type GraphProposalPayload,
};

export type RefinementDependencies = {
  knowledgebaseRepository: KnowledgebaseRepository;
  projectId: string;
};

export function createRefinementTools(deps: RefinementDependencies) {
  const searchWikiConceptsTool = createSearchWikiConceptsTool(deps);
  const proposeGraphChangesTool = createProposeGraphChangesTool();
  const searchWebTool = createSearchWebTool();
  const proposeWebSourceTool = createProposeWebSourceTool();

  return {
    'search-wiki-concepts': searchWikiConceptsTool,
    'propose-graph-changes': proposeGraphChangesTool,
    'search-web-ddg': searchWebTool,
    'propose-web-source': proposeWebSourceTool,

    // Legacy exports for tests
    searchWikiConceptsTool,
    searchWebTool,
    proposeGraphChangesTool,
    proposeWebSourceTool,
  };
}

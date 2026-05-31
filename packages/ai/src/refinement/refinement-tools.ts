import type { KnowledgebaseRepository } from '@grasp/domain';
import {
  createSearchWikiConceptsTool,
  createProposeGraphChangesTool,
  GraphProposalSchema,
  GraphProposalActionSchema,
  AddConceptSchema,
  UpdateConceptSchema,
  DeleteConceptSchema,
  AddRelationshipSchema,
  DeleteRelationshipSchema,
  AddEvidenceSchema,
  UpdateEvidenceSchema,
  DeleteEvidenceSchema,
  type GraphProposalAction,
  type GraphProposalPayload,
} from './graph-tools';
import { createSearchWebTool, createReadWebpageTool, createAddWebSourceTool } from './web-tools';

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
  onAddWebSource?: (url: string, title: string, text: string) => Promise<string>;
};

export function createRefinementTools(deps: RefinementDependencies) {
  const searchWikiConceptsTool = createSearchWikiConceptsTool(deps);
  const proposeGraphChangesTool = createProposeGraphChangesTool();
  const searchWebTool = createSearchWebTool();
  const readWebpageTool = createReadWebpageTool();
  const addWebSourceTool = createAddWebSourceTool(deps);

  return {
    'search-wiki-concepts': searchWikiConceptsTool,
    'propose-graph-changes': proposeGraphChangesTool,
    'search-web-ddg': searchWebTool,
    'read-webpage': readWebpageTool,
    'add-web-source-to-library': addWebSourceTool,

    // Legacy exports for tests
    searchWikiConceptsTool,
    searchWebTool,
    readWebpageTool,
    proposeGraphChangesTool,
    addWebSourceTool,
  };
}

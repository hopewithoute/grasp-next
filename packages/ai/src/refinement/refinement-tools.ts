import {
  createBulkCurationTool,
  createExportPassagesTool,
  createFindStaleSourcesTool,
  createFindWeakPassagesTool,
  createGetSurroundingPassagesTool,
  createListEvidenceSourcesTool,
  createProposeEvidenceCurationTool,
  createSearchEvidenceTool,
  EvidenceCurationProposalSchema,
  type EvidenceCurationProposal,
  type EvidenceKbToolApi,
} from './evidence-tools';
import { createProposeWebSourceTool, createSearchWebTool } from './web-tools';

// Re-export evidence-kb schemas and types
export { EvidenceCurationProposalSchema, type EvidenceCurationProposal, type EvidenceKbToolApi };

export type RefinementDependencies = {
  projectId: string;
  ownerId: string;
  evidenceKbService?: EvidenceKbToolApi;
};

export function createRefinementTools(deps: RefinementDependencies) {
  const searchWebTool = createSearchWebTool();
  const proposeWebSourceTool = createProposeWebSourceTool();

  const evidenceTools: Record<string, unknown> = {};
  if (deps.evidenceKbService) {
    const evidenceDeps = {
      evidenceKbService: deps.evidenceKbService,
      ownerId: deps.ownerId,
      projectId: deps.projectId,
    };
    evidenceTools['search-evidence'] = createSearchEvidenceTool(evidenceDeps);
    evidenceTools['get-surrounding-passages'] = createGetSurroundingPassagesTool(evidenceDeps);
    evidenceTools['list-evidence-sources'] = createListEvidenceSourcesTool(evidenceDeps);
    evidenceTools['propose-evidence-curation'] = createProposeEvidenceCurationTool(evidenceDeps);
    evidenceTools['find-weak-passages'] = createFindWeakPassagesTool(evidenceDeps);
    evidenceTools['find-stale-sources'] = createFindStaleSourcesTool(evidenceDeps);
    evidenceTools['bulk-curation'] = createBulkCurationTool(evidenceDeps);
    evidenceTools['export-passages'] = createExportPassagesTool(evidenceDeps);
  }

  return {
    ...evidenceTools,
    'search-web-ddg': searchWebTool,
    'propose-web-source': proposeWebSourceTool,

    // Legacy exports for tests
    searchWebTool,
    proposeWebSourceTool,
  };
}

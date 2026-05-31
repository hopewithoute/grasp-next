import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import type { IngestionAgentOutput } from '@grasp/domain';
import {
  applyAcceptedLinks,
  applyLinkPolicy,
  buildLinkTrace,
  type LinkCandidate,
  type LinkPolicyResult,
  type LinkTrace,
  type ReviewedLink,
} from '@grasp/domain';
import { adjudicateLinks } from './adjudicate-links';

export const linkingWorkflowInputDto = z.object({
  candidates: z.custom<LinkCandidate[]>(),
  extraction: z.custom<IngestionAgentOutput>(),
  useModel: z.boolean().default(true),
});

const linkingWorkflowOutputDto = z.object({
  acceptedLinks: z.custom<ReviewedLink[]>(),
  candidates: z.custom<LinkCandidate[]>(),
  patchedExtraction: z.custom<IngestionAgentOutput>(),
  policyResults: z.custom<LinkPolicyResult[]>(),
  rejectedLinks: z.custom<ReviewedLink[]>(),
  reviewedLinks: z.custom<ReviewedLink[]>(),
  trace: z.custom<LinkTrace>(),
});

const prepareLinkBatchStep = createStep({
  id: 'prepare-link-batch',
  inputSchema: linkingWorkflowInputDto,
  outputSchema: linkingWorkflowInputDto,
  execute: async ({ inputData }) => ({
    candidates: inputData.candidates,
    extraction: inputData.extraction,
    useModel: inputData.useModel,
  }),
});

const linkReviewOutputDto = linkingWorkflowInputDto.extend({
  reviewedLinks: z.custom<ReviewedLink[]>(),
});

const adjudicateLinksStep = createStep({
  id: 'adjudicate-links',
  inputSchema: linkingWorkflowInputDto,
  outputSchema: linkReviewOutputDto,
  execute: async ({ inputData }) => ({
    ...inputData,
    reviewedLinks: await adjudicateLinks({
      candidates: inputData.candidates,
      useModel: inputData.useModel,
    }),
  }),
});

const linkPolicyOutputDto = linkingWorkflowInputDto.extend({
  policyResults: z.custom<LinkPolicyResult[]>(),
  reviewedLinks: z.custom<ReviewedLink[]>(),
});

const linkAppliedOutputDto = linkPolicyOutputDto.extend({
  acceptedLinks: z.custom<ReviewedLink[]>(),
  patchedExtraction: z.custom<IngestionAgentOutput>(),
  rejectedLinks: z.custom<ReviewedLink[]>(),
});

const applyLinkPolicyStep = createStep({
  id: 'apply-link-policy',
  inputSchema: linkReviewOutputDto,
  outputSchema: linkPolicyOutputDto,
  execute: async ({ inputData }) => ({
    ...inputData,
    ...applyLinkPolicy({
      extraction: inputData.extraction,
      reviewedLinks: inputData.reviewedLinks,
    }),
  }),
});

const applyReviewedLinksStep = createStep({
  id: 'apply-reviewed-links',
  inputSchema: linkPolicyOutputDto,
  outputSchema: linkAppliedOutputDto,
  execute: async ({ inputData }) => {
    const acceptedLinks = (inputData.reviewedLinks || []).filter((link) => {
      const policy = inputData.policyResults.find((p) => p.candidateId === link.candidateId);
      return policy?.decision === 'accept';
    });
    const rejectedLinks = (inputData.reviewedLinks || []).filter((link) => {
      const policy = inputData.policyResults.find((p) => p.candidateId === link.candidateId);
      return policy?.decision === 'reject';
    });

    return {
      acceptedLinks,
      candidates: inputData.candidates,
      extraction: inputData.extraction,
      patchedExtraction: applyAcceptedLinks(inputData.extraction, acceptedLinks),
      policyResults: inputData.policyResults,
      rejectedLinks,
      reviewedLinks: inputData.reviewedLinks,
      useModel: inputData.useModel,
    };
  },
});

const summarizeLinkTraceStep = createStep({
  id: 'summarize-linking-trace',
  inputSchema: linkAppliedOutputDto,
  outputSchema: linkingWorkflowOutputDto,
  execute: async ({ inputData, writer }) => {
    if (writer) {
      for (const link of inputData.acceptedLinks) {
        await writer.write({
          type: 'link_applied',
          candidateId: link.candidateId,
          relationshipType: link.relationshipType || 'related',
          sourceConceptName: link.sourceConceptKey || 'Source',
          targetConceptName: link.targetConceptKey || 'Target',
        });
      }
    }

    return {
      acceptedLinks: inputData.acceptedLinks,
      candidates: inputData.candidates,
      patchedExtraction: inputData.patchedExtraction,
      policyResults: inputData.policyResults,
      rejectedLinks: inputData.rejectedLinks,
      reviewedLinks: inputData.reviewedLinks,
      trace: buildLinkTrace({
        acceptedLinks: inputData.acceptedLinks,
        appliedLinks: inputData.acceptedLinks,
        candidates: inputData.candidates,
        extraction: inputData.extraction,
        policyResults: inputData.policyResults,
        rejectedLinks: inputData.rejectedLinks,
        reviewedLinks: inputData.reviewedLinks,
      }),
    };
  },
});

export const sourceLinkingWorkflow = createWorkflow({
  id: 'source-ingestion-linking',
  inputSchema: linkingWorkflowInputDto,
  outputSchema: linkingWorkflowOutputDto,
})
  .then(prepareLinkBatchStep)
  .then(adjudicateLinksStep)
  .then(applyLinkPolicyStep)
  .then(applyReviewedLinksStep)
  .then(summarizeLinkTraceStep)
  .commit();

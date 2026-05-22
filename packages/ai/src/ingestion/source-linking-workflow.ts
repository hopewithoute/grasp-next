import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import type { IngestionAgentOutput } from '@grasp/domain';
import {
  applyAcceptedLinks,
  applyLinkPolicy,
  buildLinkTrace,
  linkCandidateDto,
  linkPolicyResultDto,
  linkTraceDto,
  reviewedLinkDto,
} from './linking';
import { adjudicateLinks } from './adjudicate-links';

const linkingWorkflowInputDto = z.object({
  candidates: z.array(linkCandidateDto),
  extraction: z.custom<IngestionAgentOutput>(),
  useModel: z.boolean().default(true),
});

const linkingWorkflowOutputDto = z.object({
  acceptedLinks: z.array(reviewedLinkDto),
  candidates: z.array(linkCandidateDto),
  patchedExtraction: z.custom<IngestionAgentOutput>(),
  policyResults: z.array(linkPolicyResultDto),
  rejectedLinks: z.array(reviewedLinkDto),
  reviewedLinks: z.array(reviewedLinkDto),
  trace: linkTraceDto,
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
  reviewedLinks: z.array(reviewedLinkDto),
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
  policyResults: z.array(linkPolicyResultDto),
  reviewedLinks: z.array(reviewedLinkDto),
});

const linkAppliedOutputDto = linkPolicyOutputDto.extend({
  acceptedLinks: z.array(reviewedLinkDto),
  patchedExtraction: z.custom<IngestionAgentOutput>(),
  rejectedLinks: z.array(reviewedLinkDto),
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
    const acceptedLinks = inputData.reviewedLinks.filter(
      (link) => link.decision === 'accept'
    );
    const rejectedLinks = inputData.reviewedLinks.filter(
      (link) => link.decision === 'reject'
    );

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
  execute: async ({ inputData }) => ({
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
  }),
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

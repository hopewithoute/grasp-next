import { CONCEPT_EXTRACTION_WORKFLOW } from '@grasp/domain';
import type { ReviewConceptsSuspendDto } from './extract-concepts-workflow';

export function parseReviewConceptsSuspendPayload(payload: unknown): ReviewConceptsSuspendDto {
  const reviewPayload = getReviewConceptsSuspendPayload(payload);

  if (reviewPayload) {
    return reviewPayload;
  }

  throw new Error('concept_extraction_workflow_missing_review_payload');
}

function getReviewConceptsSuspendPayload(payload: unknown): ReviewConceptsSuspendDto | null {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'conceptGraph' in payload &&
    'extractionMode' in payload &&
    'reason' in payload &&
    payload.reason === CONCEPT_EXTRACTION_WORKFLOW.REVIEW_SUSPEND_REASON
  ) {
    return payload as ReviewConceptsSuspendDto;
  }

  if (
    typeof payload === 'object' &&
    payload !== null &&
    CONCEPT_EXTRACTION_WORKFLOW.STEP_ID in payload
  ) {
    return getReviewConceptsSuspendPayload(payload[CONCEPT_EXTRACTION_WORKFLOW.STEP_ID]);
  }

  return null;
}

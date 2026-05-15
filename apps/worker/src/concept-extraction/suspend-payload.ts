import type { ReviewConceptsSuspendDto } from "@grasp/ai";

export function parseReviewConceptsSuspendPayload(
  payload: unknown
): ReviewConceptsSuspendDto {
  const reviewPayload = getReviewConceptsSuspendPayload(payload);

  if (reviewPayload) {
    return reviewPayload;
  }

  throw new Error("concept_extraction_workflow_missing_review_payload");
}

function getReviewConceptsSuspendPayload(
  payload: unknown
): ReviewConceptsSuspendDto | null {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "conceptGraph" in payload &&
    "extractionMode" in payload &&
    "reason" in payload &&
    payload.reason === "review_concepts"
  ) {
    return payload as ReviewConceptsSuspendDto;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "extract-concepts" in payload
  ) {
    return getReviewConceptsSuspendPayload(payload["extract-concepts"]);
  }

  return null;
}

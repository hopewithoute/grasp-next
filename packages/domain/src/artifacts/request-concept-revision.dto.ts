import { uuidString, v } from '../validation';

export const requestConceptRevisionDto = v.object({
  artifactId: uuidString,
  revisionFeedback: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(4000)),
});

export type RequestConceptRevisionInput = v.InferOutput<typeof requestConceptRevisionDto>;

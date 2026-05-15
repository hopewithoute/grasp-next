import { z } from 'zod';

export const requestConceptRevisionDto = z.object({
  artifactId: z.uuid(),
  revisionFeedback: z.string().trim().min(1).max(4000),
});

export type RequestConceptRevisionInput = z.infer<typeof requestConceptRevisionDto>;

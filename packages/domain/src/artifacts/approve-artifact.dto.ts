import { z } from 'zod';

export const approveArtifactDto = z.object({
  artifactId: z.uuid(),
});

export type ApproveArtifactInput = z.infer<typeof approveArtifactDto>;

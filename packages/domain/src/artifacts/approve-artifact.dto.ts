import { uuidString, v } from '../validation';

export const approveArtifactDto = v.object({
  artifactId: uuidString,
});

export type ApproveArtifactInput = v.InferOutput<typeof approveArtifactDto>;

export type GraphProposalAction = {
  type: string;
  payload: Record<string, unknown>;
};

export type ApplyGraphProposalsInput = {
  projectId: string;
  actions: GraphProposalAction[];
};

export type ApplyGraphProposalsResult = {
  success: boolean;
  applied: number;
};

export async function applyGraphProposals(
  input: ApplyGraphProposalsInput
): Promise<ApplyGraphProposalsResult> {
  return { success: true, applied: 0 };
}

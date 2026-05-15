export function buildConceptExtractionPrompt(sourceMaterial: string) {
  return `
    Extract the concept graph from this source material.

    Rules:
    - Return 3 to 8 important concepts when the material supports it.
    - Every concept must have at least one source evidence excerpt copied from the material.
    - Confidence must be a number from 0 to 1.
    - Relationships must use concept names from the returned concepts.
    - Use prerequisite relationships only when one concept should be understood before another.

    Source material:
    ${sourceMaterial}
    `;
}

export function buildLooserConceptExtractionPrompt(sourceMaterial: string) {
  return `
Extract the concept graph from this source material.

Rules:
- Return valid JSON only.
- Use this exact shape: {"concepts":[{"name":"...","definition":"...","difficulty":"beginner|intermediate|advanced","confidence":0.8,"sourceEvidence":[{"excerpt":"exact source quote","location":"optional"}]}],"relationships":[{"relationshipType":"prerequisite","sourceConceptName":"...","targetConceptName":"..."}]}.
- confidence must be a number from 0 to 1, not a label.
- sourceEvidence must be an array of objects, not a string and not source_evidence.
- Relationships must use concept names from the returned concepts.
- Use prerequisite relationships only when one concept should be understood before another.

Source material:
${sourceMaterial}
`;
}

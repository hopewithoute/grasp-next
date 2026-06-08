import { conceptDifficultyDto } from '../concepts';
import { knowledgebaseRelationshipTypeDto } from '../knowledgebase';
import { confidenceScore, requiredString, v } from '../validation';

export const proposalDifficultyDto = v.optional(
  v.pipe(
    v.unknown(),
    v.transform((value) => (typeof value === 'string' ? value.toLowerCase() : value)),
    conceptDifficultyDto
  ),
  'beginner'
);

export const proposalConfidenceDto = v.pipe(
  v.unknown(),
  v.transform((value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const upper = value.toUpperCase();
      if (upper === 'HIGH') return 0.9;
      if (upper === 'MEDIUM') return 0.6;
      if (upper === 'LOW') return 0.3;
      const parsed = Number.parseFloat(value);
      return Number.isNaN(parsed) ? 0.5 : Math.max(0, Math.min(1, parsed));
    }
    return 0.5;
  }),
  confidenceScore
);

export const addConceptProposalDto = v.object({
  conceptKey: requiredString,
  name: requiredString,
  definition: requiredString,
  difficulty: proposalDifficultyDto,
  confidence: proposalConfidenceDto,
  metadata: v.optional(v.record(v.string(), v.unknown())),
});

export const updateConceptProposalDto = v.object({
  conceptKey: requiredString,
  name: v.optional(requiredString),
  definition: v.optional(requiredString),
  difficulty: v.optional(proposalDifficultyDto),
  confidence: v.optional(proposalConfidenceDto),
  metadata: v.optional(v.record(v.string(), v.unknown())),
});

export const deleteConceptProposalDto = v.object({
  conceptKey: requiredString,
});

export const addRelationshipProposalDto = v.object({
  sourceConceptKey: requiredString,
  targetConceptKey: requiredString,
  relationshipType: knowledgebaseRelationshipTypeDto,
  rationale: v.optional(requiredString),
});

export const deleteRelationshipProposalDto = v.object({
  sourceConceptKey: requiredString,
  targetConceptKey: requiredString,
  relationshipType: knowledgebaseRelationshipTypeDto,
});

export const addEvidenceProposalDto = v.pipe(
  v.unknown(),
  v.transform((value) => {
    if (!value || typeof value !== 'object') {
      return value;
    }

    const object = { ...(value as Record<string, unknown>) };
    if (!object.evidenceText && object.excerpt) {
      object.evidenceText = object.excerpt;
    }
    if (!object.rationale && object.reasoning) {
      object.rationale = object.reasoning;
    }
    return object;
  }),
  v.object({
    conceptKey: requiredString,
    evidenceText: v.optional(requiredString, 'AI extracted evidence'),
    rationale: v.optional(requiredString, 'AI extracted rationale'),
    url: v.optional(v.pipe(v.string(), v.trim())),
    title: v.optional(requiredString, 'AI Search Result'),
    sourceType: v.optional(v.pipe(v.string(), v.trim())),
  })
);

export const updateEvidenceProposalDto = v.object({
  evidenceId: requiredString,
  evidenceText: v.optional(requiredString),
  rationale: v.optional(requiredString),
});

export const deleteEvidenceProposalDto = v.object({
  evidenceId: requiredString,
});

import { z } from 'zod';
import { conceptDifficultyDto } from '../concepts';
import { knowledgebaseRelationshipTypeDto } from '../knowledgebase';

// Preprocessor for difficulty to handle case and defaults
export const proposalDifficultyDto = z.preprocess((val) => {
  if (typeof val === 'string') return val.toLowerCase();
  return val;
}, conceptDifficultyDto).default('beginner');

// Preprocessor for confidence to handle strings like 'HIGH', '0.85', and defaulting
export const proposalConfidenceDto = z.preprocess((val) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const upper = val.toUpperCase();
    if (upper === 'HIGH') return 0.9;
    if (upper === 'MEDIUM') return 0.6;
    if (upper === 'LOW') return 0.3;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0.5 : Math.max(0, Math.min(1, parsed));
  }
  return 0.5;
}, z.number().min(0).max(1));

export const addConceptProposalDto = z.object({
  conceptKey: z.string().trim().min(1),
  name: z.string().trim().min(1),
  definition: z.string().trim().min(1),
  difficulty: proposalDifficultyDto,
  confidence: proposalConfidenceDto,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateConceptProposalDto = z.object({
  conceptKey: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  definition: z.string().trim().min(1).optional(),
  difficulty: proposalDifficultyDto.optional(),
  confidence: proposalConfidenceDto.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const deleteConceptProposalDto = z.object({
  conceptKey: z.string().trim().min(1),
});

export const addRelationshipProposalDto = z.object({
  sourceConceptKey: z.string().trim().min(1),
  targetConceptKey: z.string().trim().min(1),
  relationshipType: knowledgebaseRelationshipTypeDto,
  rationale: z.string().trim().min(1).optional(),
});

export const deleteRelationshipProposalDto = z.object({
  sourceConceptKey: z.string().trim().min(1),
  targetConceptKey: z.string().trim().min(1),
  relationshipType: knowledgebaseRelationshipTypeDto,
});

export const addEvidenceProposalDto = z.preprocess((val: any) => {
  if (val && typeof val === 'object') {
    if (!val.evidenceText && val.excerpt) {
      val.evidenceText = val.excerpt;
    }
    if (!val.rationale && val.reasoning) {
      val.rationale = val.reasoning;
    }
  }
  return val;
}, z.object({
  conceptKey: z.string().trim().min(1),
  evidenceText: z.string().trim().min(1).default('AI extracted evidence'),
  rationale: z.string().trim().min(1).default('AI extracted rationale'),
  url: z.string().trim().optional(),
  title: z.string().trim().min(1).default('AI Search Result').optional(),
  sourceType: z.string().trim().optional(),
}));

export const updateEvidenceProposalDto = z.object({
  evidenceId: z.string().trim().min(1),
  evidenceText: z.string().trim().min(1).optional(),
  rationale: z.string().trim().min(1).optional(),
});

export const deleteEvidenceProposalDto = z.object({
  evidenceId: z.string().trim().min(1),
});

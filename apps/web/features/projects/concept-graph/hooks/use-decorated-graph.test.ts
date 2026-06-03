import { describe, expect, it } from 'vitest';
import { type ConceptRow, type RelationshipRow } from '../types';
import { type ProposalPayload } from '../types';
import { mergeProposals } from './use-decorated-graph';

const concepts: ConceptRow[] = [
  {
    confidence: '0.92',
    definition: 'Force changes motion.',
    difficulty: 'beginner',
    id: 'c1',
    name: 'Force',
  },
  {
    confidence: '0.81',
    definition: 'Acceleration is the rate of change of velocity.',
    difficulty: 'intermediate',
    id: 'c2',
    name: 'Acceleration',
  },
];

const relationships: RelationshipRow[] = [
  {
    id: 'r1',
    relationshipType: 'prerequisite',
    sourceConceptId: 'c1',
    targetConceptId: 'c2',
  },
];

describe('mergeProposals', () => {
  it('returns original concepts and relationships when no proposals', () => {
    const result = mergeProposals(concepts, relationships, []);

    expect(result.mergedConcepts.length).toBe(2);
    expect(result.mergedRelationships.length).toBe(1);
    expect(result.ghostAddIds.size).toBe(0);
    expect(result.ghostUpdateIds.size).toBe(0);
    expect(result.ghostDeleteIds.size).toBe(0);
    expect(result.ghostRelAddIds.size).toBe(0);
    expect(result.ghostRelDeleteIds.size).toBe(0);
  });

  describe('add_concept', () => {
    it('adds a ghost concept from proposal', () => {
      const proposals: ProposalPayload[] = [
        {
          rationale: 'test',
          actions: [
            {
              type: 'add_concept',
              payload: {
                conceptKey: 'momentum',
                name: 'Momentum',
                definition: 'Mass times velocity.',
                difficulty: 'intermediate',
                confidence: '0.85',
              },
            },
          ],
        },
      ];

      const result = mergeProposals(concepts, relationships, proposals as unknown);

      expect(result.mergedConcepts.length).toBe(3);
      expect(result.ghostAddIds.size).toBe(1);
      expect(result.ghostAddIds.has('momentum')).toBeTruthy();

      const ghost = result.mergedConcepts.find((c) => c.id === 'momentum');
      expect(ghost).toBeTruthy();
      expect(ghost!.name).toBeTruthy();
      expect(ghost!.definition).toBe('Mass times velocity.');
    });

    it('uses name as fallback id when conceptKey is missing', () => {
      const proposals: ProposalPayload[] = [
        {
          rationale: 'test',
          actions: [
            {
              type: 'add_concept',
              payload: {
                name: 'Velocity',
                definition: 'Speed with direction.',
                difficulty: 'beginner',
                confidence: '0.9',
              },
            },
          ],
        },
      ];

      const result = mergeProposals(concepts, relationships, proposals as unknown);

      expect(result.mergedConcepts.length).toBe(3);
      expect(result.ghostAddIds.has('Velocity')).toBeTruthy();
    });

    it('generates fallback id when neither conceptKey nor name present', () => {
      const proposals: ProposalPayload[] = [
        {
          rationale: 'test',
          actions: [
            {
              type: 'add_concept',
              payload: {
                definition: 'Something.',
                difficulty: 'beginner',
                confidence: '0.5',
              },
            },
          ],
        },
      ];

      const result = mergeProposals(concepts, relationships, proposals as unknown);

      expect(result.mergedConcepts.length).toBe(3);
      expect(result.ghostAddIds.size).toBe(1);
      const ghostId = [...result.ghostAddIds][0]!;
      expect(ghostId.startsWith('ghost-')).toBeTruthy();
    });
  });

  describe('update_concept', () => {
    it('marks existing concept as ghost-update', () => {
      const proposals: ProposalPayload[] = [
        {
          rationale: 'test',
          actions: [
            {
              type: 'update_concept',
              payload: {
                conceptKey: 'c1',
                name: 'Force (updated)',
                definition: 'Updated definition.',
              },
            },
          ],
        },
      ];

      const result = mergeProposals(concepts, relationships, proposals as unknown);

      expect(result.mergedConcepts.length).toBe(2);
      expect(result.ghostUpdateIds.size).toBe(1);
      expect(result.ghostUpdateIds.has('c1')).toBeTruthy();

      const updated = result.mergedConcepts.find((c) => c.id === 'c1');
      expect(updated).toBeTruthy();
      expect(updated!.name).toBeTruthy();
      expect(updated!.definition).toBe('Updated definition.');
    });

    it('finds concept by name when conceptKey is missing', () => {
      const proposals: ProposalPayload[] = [
        {
          rationale: 'test',
          actions: [
            {
              type: 'update_concept',
              payload: {
                name: 'force',
                definition: 'Updated via name lookup.',
              },
            },
          ],
        },
      ];

      const result = mergeProposals(concepts, relationships, proposals as unknown);

      expect(result.ghostUpdateIds.size).toBe(1);
      expect(result.ghostUpdateIds.has('c1')).toBeTruthy();
    });

    it('does nothing when target concept is not found', () => {
      const proposals: ProposalPayload[] = [
        {
          rationale: 'test',
          actions: [
            {
              type: 'update_concept',
              payload: {
                conceptKey: 'nonexistent',
                name: 'Ghost',
              },
            },
          ],
        },
      ];

      const result = mergeProposals(concepts, relationships, proposals as unknown);

      expect(result.ghostUpdateIds.size).toBe(0);
      expect(result.mergedConcepts.length).toBe(2);
    });
  });

  describe('delete_concept', () => {
    it('marks concept as ghost-delete', () => {
      const proposals: ProposalPayload[] = [
        {
          rationale: 'test',
          actions: [
            {
              type: 'delete_concept',
              payload: { conceptKey: 'c2' },
            },
          ],
        },
      ];

      const result = mergeProposals(concepts, relationships, proposals as unknown);

      expect(result.ghostDeleteIds.size).toBe(1);
      expect(result.ghostDeleteIds.has('c2')).toBeTruthy();
      expect(result.mergedConcepts.length, 'concept stays in list for rendering').toBe(2);
    });
  });

  describe('add_relationship', () => {
    it('adds a ghost relationship between existing concepts', () => {
      const proposals: ProposalPayload[] = [
        {
          rationale: 'test',
          actions: [
            {
              type: 'add_relationship',
              payload: {
                sourceConceptKey: 'c2',
                targetConceptKey: 'c1',
                relationshipType: 'related_to',
              },
            },
          ],
        },
      ];

      const result = mergeProposals(concepts, relationships, proposals as unknown);

      expect(result.mergedRelationships.length).toBe(2);
      expect(result.ghostRelAddIds.size).toBe(1);

      const ghostRel = result.mergedRelationships.find((r) => r.sourceConceptId === 'c2');
      expect(ghostRel).toBeTruthy();
      expect(ghostRel!.targetConceptId).toBeTruthy();
      expect(ghostRel!.relationshipType).toBe('related_to');
    });

    it('skips when source concept is not found', () => {
      const proposals: ProposalPayload[] = [
        {
          rationale: 'test',
          actions: [
            {
              type: 'add_relationship',
              payload: {
                sourceConceptKey: 'nonexistent',
                targetConceptKey: 'c1',
                relationshipType: 'related_to',
              },
            },
          ],
        },
      ];

      const result = mergeProposals(concepts, relationships, proposals as unknown);

      expect(result.mergedRelationships.length).toBe(1);
      expect(result.ghostRelAddIds.size).toBe(0);
    });

    it('skips when target concept is not found', () => {
      const proposals: ProposalPayload[] = [
        {
          rationale: 'test',
          actions: [
            {
              type: 'add_relationship',
              payload: {
                sourceConceptKey: 'c1',
                targetConceptKey: 'nonexistent',
                relationshipType: 'related_to',
              },
            },
          ],
        },
      ];

      const result = mergeProposals(concepts, relationships, proposals as unknown);

      expect(result.mergedRelationships.length).toBe(1);
      expect(result.ghostRelAddIds.size).toBe(0);
    });
  });

  describe('delete_relationship', () => {
    it('marks existing relationship as ghost-delete', () => {
      const proposals: ProposalPayload[] = [
        {
          rationale: 'test',
          actions: [
            {
              type: 'delete_relationship',
              payload: {
                sourceConceptKey: 'c1',
                targetConceptKey: 'c2',
                relationshipType: 'prerequisite',
              },
            },
          ],
        },
      ];

      const result = mergeProposals(concepts, relationships, proposals as unknown);

      expect(result.ghostRelDeleteIds.size).toBe(1);
      expect(result.ghostRelDeleteIds.has('r1')).toBeTruthy();
    });
  });

  describe('multiple proposals', () => {
    it('handles add then update on same proposal batch', () => {
      const proposals: ProposalPayload[] = [
        {
          rationale: 'test',
          actions: [
            {
              type: 'add_concept',
              payload: {
                conceptKey: 'energy',
                name: 'Energy',
                definition: 'Capacity to do work.',
                difficulty: 'beginner',
                confidence: '0.9',
              },
            },
            {
              type: 'add_relationship',
              payload: {
                sourceConceptKey: 'c1',
                targetConceptKey: 'energy',
                relationshipType: 'explains',
              },
            },
          ],
        },
      ];

      const result = mergeProposals(concepts, relationships, proposals as unknown);

      expect(result.mergedConcepts.length).toBe(3);
      expect(result.mergedRelationships.length).toBe(2);
      expect(result.ghostAddIds.size).toBe(1);
      expect(result.ghostRelAddIds.size).toBe(1);
    });

    it('handles action type with hyphen (add_concept vs add-concept)', () => {
      const proposals: ProposalPayload[] = [
        {
          rationale: 'test',
          actions: [
            {
              type: 'add_concept' as ProposalPayload['actions'][number]['type'],
              payload: {
                conceptKey: 'work',
                name: 'Work',
                definition: 'Force times distance.',
                difficulty: 'beginner',
                confidence: '0.8',
              },
            },
          ],
        },
      ];

      const result = mergeProposals(concepts, relationships, proposals as unknown);

      expect(result.ghostAddIds.size).toBe(1);
      expect(result.ghostAddIds.has('work')).toBeTruthy();
    });
  });

  describe('immutability', () => {
    it('does not mutate input arrays', () => {
      const proposals: ProposalPayload[] = [
        {
          rationale: 'test',
          actions: [
            {
              type: 'add_concept',
              payload: {
                conceptKey: 'momentum',
                name: 'Momentum',
                definition: 'Mass times velocity.',
                difficulty: 'intermediate',
                confidence: '0.85',
              },
            },
          ],
        },
      ];

      const conceptsCopy = [...concepts];
      const relationshipsCopy = [...relationships];

      mergeProposals(concepts, relationships, proposals as unknown);

      expect(concepts).toEqual(conceptsCopy);
      expect(relationships).toEqual(relationshipsCopy);
    });
  });
});

/**
 * Ingestion stream events — emitted during the source ingestion pipeline.
 *
 * These are the 17-variant discriminated union that the UI consumes.
 * The domain action emits to a narrow {@link IngestionProgressPort};
 * each consumer (API route, CLI, test spy) adapts to its own format.
 */

export type IngestionStreamEvent =
  | { type: 'ingestion_started'; sourceId: string; sourceTitle: string }
  | { type: 'chunk_processing'; chunkIndex: number; totalChunks: number }
  | { type: 'agent_thinking'; chunkIndex: number; thinking: string }
  | {
      type: 'retrieval_activity';
      hitCount: number;
      query: string;
      retrievalType: 'concept_search' | 'concept_neighbors';
    }
  | { type: 'concept_extracted'; conceptKey: string; name: string; isNew: boolean }
  | {
      type: 'link_applied';
      candidateId: string;
      relationshipType: string;
      sourceConceptName: string;
      targetConceptName: string;
    }
  | {
      type: 'link_candidate_generated';
      candidateId: string;
      relationshipType: string;
      resolutionType: 'exact' | 'semantic';
      sourceConceptName: string;
      targetConceptName: string;
    }
  | {
      type: 'link_candidate_reviewed';
      candidateId: string;
      confidence: number;
      decision: 'accept' | 'reject';
      evidenceStrength: 'strong' | 'usable' | 'weak' | 'rejected';
      finalEvidenceScore: number;
    }
  | {
      type: 'link_policy_applied';
      candidateId: string;
      decision: 'accept' | 'reject';
      reason: string;
    }
  | {
      type: 'link_rejected';
      candidateId: string;
      reason: string;
      sourceConceptName: string;
      targetConceptName: string;
    }
  | {
      type: 'relation_claim_extracted';
      objectText: string;
      predicate: string;
      subjectText: string;
    }
  | { type: 'relationship_extracted'; source: string; target: string }
  | {
      type: 'evidence_dropped';
      chunkIndex: number;
      droppedConceptKeys: string[];
      droppedRefCount: number;
    }
  | { type: 'ingestion_complete'; conceptCount: number; relationshipCount: number }
  | { type: 'ingestion_failed'; reason: string };

/**
 * Narrow progress port — the domain action emits to this interface.
 * Each consumer adapts to its own format (API events, CLI stderr, test spy).
 */
export type IngestionProgressPort = (event: IngestionStreamEvent) => void;

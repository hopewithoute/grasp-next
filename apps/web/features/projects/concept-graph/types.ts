

export type DifficultyFilter = 'all' | ConceptRow['difficulty'];

export type WorkspaceEvent =
  | { type: 'assistant_message'; text: string }
  | { type: 'source_read'; sourceId: string; title?: string }
  | { type: 'concept_proposed'; name: string; definition?: string }
  | {
      type: 'relationship_proposed';
      source: string;
      target: string;
      relationshipType: string;
    }
  | { type: 'evidence_attached'; concept: string; excerpt: string; location?: string }
  | { type: 'ingestion_complete'; conceptCount: number; relationshipCount: number }
  | { type: 'agent_activity'; label: string; detail: string; status?: 'started' | 'completed' };

export type StreamEvent = Exclude<WorkspaceEvent, { type: 'assistant_message' }>;

import { type ProposalPayload } from './proposal-card';

export type ChatItem =
  | {
      id: string;
      kind: 'message';
      role: 'agent' | 'user';
      streaming?: boolean;
      text: string;
    }
  | {
      id: string;
      kind: 'event';
      event: StreamEvent;
    }
  | {
      id: string;
      kind: 'proposal';
      proposal: ProposalPayload;
      status: 'pending' | 'approved' | 'rejected';
    };

export type SourceEvidence = {
  blockId?: string;
  excerpt: string;
  location?: string;
  sourceId?: string;
};

export type ConceptRow = {
  confidence: string;
  definition: string;
  difficulty: 'advanced' | 'beginner' | 'intermediate';
  id: string;
  name: string;
  sourceEvidence?: SourceEvidence[] | null;
  evidenceCount?: number;
};

export type RelationshipRow = {
  id: string;
  metadata?: unknown;
  relationshipType: string;
  sourceEvidence?: SourceEvidence[] | null;
  evidenceCount?: number;
  sourceConceptId: string;
  targetConceptId: string;
};

export type ConceptGraphArtifact = {
  id: string;
  status: string;
} | null;

export type ConceptGraphReviewProps = {
  artifact: ConceptGraphArtifact;
  concepts: ConceptRow[];
  relationships: RelationshipRow[];
};

export type ConceptNodeData = {
  confidence: string;
  difficulty: ConceptRow['difficulty'];
  label: string;
  selected?: boolean;
  isHoveredChat?: boolean;
  isGhostAdd?: boolean;
  isGhostUpdate?: boolean;
  isGhostDelete?: boolean;
  onViewDetails?: () => void;
};

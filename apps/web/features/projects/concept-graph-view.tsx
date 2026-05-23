import { 
  buildConceptGraph,
  getEvidence, 
  shortenBlockId, 
  formatConfidence, 
  formatRelationshipType,
  type SourceEvidence 
} from './concept-graph-utils';
'use client';

import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  useReactFlow,
} from '@xyflow/react';
import { Expand, Filter, LayoutGrid, Minus, Plus, Search, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { artifactStatusVariant, conceptDifficultyVariants } from './project-style-variants';

export type ConceptRow = {
  confidence: string;
  definition: string;
  difficulty: 'advanced' | 'beginner' | 'intermediate';
  id: string;
  name: string;
  sourceEvidence: unknown;
};

export type RelationshipRow = {
  id: string;
  metadata?: unknown;
  relationshipType: string;
  sourceEvidence?: unknown;
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
};


import { useState, useRef, useCallback } from 'react';
import { getConceptEvidence } from '../../actions';
import { getEvidence, type SourceEvidence } from '../concept-graph-utils';

export type EvidenceLoaderState = {
  conceptId: string | null;
  evidence: SourceEvidence[];
  isLoading: boolean;
};

export function useEvidenceLoader(projectId: string) {
  const [conceptId, setConceptId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<SourceEvidence[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  const open = useCallback(
    (targetConceptId: string) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setConceptId(targetConceptId);
      setEvidence([]);
      setIsLoading(true);

      getConceptEvidence(projectId, targetConceptId)
        .then((data) => {
          if (requestIdRef.current !== requestId) return;
          setEvidence(getEvidence(data as Parameters<typeof getEvidence>[0]));
        })
        .finally(() => {
          if (requestIdRef.current === requestId) {
            setIsLoading(false);
          }
        });
    },
    [projectId]
  );

  const close = useCallback(() => {
    requestIdRef.current += 1;
    setConceptId(null);
    setEvidence([]);
    setIsLoading(false);
  }, []);

  return { conceptId, evidence, isLoading, open, close } as const;
}

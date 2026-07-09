'use client';

import { useEffect, useState } from 'react';
import type { EvidenceKbSource } from '../../../../server/evidence-kb';
import { getEvidenceKbSourceViewerUrlAction } from '../../actions';
import { Loader2 } from 'lucide-react';

export function SourceViewer({
  projectId,
  source,
}: {
  projectId: string;
  source: EvidenceKbSource;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchUrl() {
      setIsLoading(true);
      setError(null);
      setUrl(null);
      setHtml(null);
      
      try {
        const result = await getEvidenceKbSourceViewerUrlAction({
          projectId,
          sourceId: source.external_source_id,
        });
        
        if (!isMounted) return;

        if (result && result.url) {
          setUrl(result.url);
        } else if (result && result.html) {
          setHtml(result.html);
        } else {
          setError('Viewer URL not available for this source.');
        }
      } catch (err) {
        if (!isMounted) return;
        setError('Failed to load viewer.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchUrl();

    return () => {
      isMounted = false;
    };
  }, [projectId, source.external_source_id]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 bg-white/[0.01]">
        <Loader2 className="size-6 animate-spin text-brand-accent/50" />
        <span className="mt-4 font-mono text-[0.65rem] tracking-widest text-muted-foreground uppercase">
          [ LOADING VIEWER... ]
        </span>
      </div>
    );
  }

  if (error || (!url && !html)) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 bg-white/[0.01]">
        <div className="text-destructive font-mono text-[0.65rem] tracking-widest uppercase">
          [ ERROR: {error || 'NOT AVAILABLE'} ]
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full bg-white relative">
      <iframe 
        src={url || undefined}
        srcDoc={html || undefined}
        className="absolute inset-0 w-full h-full border-none" 
        title="Source Viewer"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

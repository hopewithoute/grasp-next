import { NextRequest } from 'next/server';
import { getActor } from '@/server/actor';
import { serverEnv } from '@/server/env';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const actor = await getActor();
  if (!actor) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const { projectId } = await params;

  const backendUrl = `${serverEnv.EVIDENCE_KB_BASE_URL}/v1/ingest/projects/${projectId}/runs/events`;
  
  try {
    const res = await fetch(backendUrl, {
      headers: {
        'x-api-key': serverEnv.EVIDENCE_KB_API_KEY || '',
      },
      // Ensure fetch doesn't buffer the stream
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('SSE Proxy Error:', await res.text());
      return new Response('Error connecting to SSE backend', { status: res.status });
    }

    return new Response(res.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('SSE Proxy Fetch Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

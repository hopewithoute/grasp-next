import 'server-only';

import { Queue, type ConnectionOptions } from 'bullmq';
import { serverEnv } from './env';

type ConceptExtractionJob = {
  projectId: string;
  revisionFeedback?: string | null;
};

function parseRedisConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  const db = url.pathname === '/' ? undefined : Number(url.pathname.slice(1));

  if (db !== undefined && !Number.isInteger(db)) {
    throw new Error('QUEUE_REDIS_URL database path must be an integer.');
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
}

export function createConceptExtractionQueue() {
  const queue = new Queue<ConceptExtractionJob>('concept-extraction', {
    connection: parseRedisConnection(serverEnv.QUEUE_REDIS_URL),
    prefix: serverEnv.QUEUE_PREFIX,
  });

  return {
    async enqueueConceptExtraction(input: ConceptExtractionJob) {
      await queue.add('extract-concepts', input);
    },
  };
}

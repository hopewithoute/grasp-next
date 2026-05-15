import {
  createArtifactReviewRunRepository,
  createArtifactRepository,
  createAuditLogRepository,
  createConceptRepository,
  createDbClient,
  createProjectRepository,
} from '@grasp/db';
import { Worker } from 'bullmq';
import { processConceptExtractionJob } from './concept-extraction/job-handler.js';
import { parseRedisConnection, type ConceptExtractionJob } from './concept-extraction-queue.js';
import { serverEnv } from './env.js';

const db = createDbClient(serverEnv.DATABASE_URL);

const worker = new Worker<ConceptExtractionJob>(
  'concept-extraction',
  async (job) => {
    await processConceptExtractionJob(job.data, {
      artifactRepository: createArtifactRepository(db),
      artifactReviewRunRepository: createArtifactReviewRunRepository(db),
      auditLogRepository: createAuditLogRepository(db),
      conceptRepository: createConceptRepository(db),
      projectRepository: createProjectRepository(db),
    });
  },
  {
    connection: parseRedisConnection(serverEnv.QUEUE_REDIS_URL),
    prefix: serverEnv.QUEUE_PREFIX,
  }
);

worker.on('failed', async (job, error) => {
  console.error('Concept extraction job failed.', {
    error,
    jobId: job?.id,
    projectId: job?.data.projectId,
  });
});

console.log(
  `Grasp worker listening for concept extraction jobs with queue prefix "${serverEnv.QUEUE_PREFIX}".`
);

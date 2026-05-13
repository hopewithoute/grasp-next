import "server-only";

import { Queue, type ConnectionOptions } from "bullmq";

type QueueConfig = {
  prefix: string;
  redisUrl: string;
};

type ConceptExtractionJob = {
  projectId: string;
};

function parseRedisConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  const db = url.pathname === "/" ? undefined : Number(url.pathname.slice(1));

  if (db !== undefined && !Number.isInteger(db)) {
    throw new Error("QUEUE_REDIS_URL database path must be an integer.");
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db,
    tls: url.protocol === "rediss:" ? {} : undefined,
  };
}

function getQueueConfig(): QueueConfig {
  return {
    prefix: process.env.QUEUE_PREFIX ?? "grasp",
    redisUrl: process.env.QUEUE_REDIS_URL ?? "redis://localhost:6379",
  };
}

export function createConceptExtractionQueue() {
  const config = getQueueConfig();
  const queue = new Queue<ConceptExtractionJob>("concept-extraction", {
    connection: parseRedisConnection(config.redisUrl),
    prefix: config.prefix,
  });

  return {
    async enqueueConceptExtraction(input: ConceptExtractionJob) {
      await queue.add("extract-concepts", input);
    },
  };
}

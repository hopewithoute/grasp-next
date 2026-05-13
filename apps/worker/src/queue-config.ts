export type QueueConfig = {
  prefix: string;
  redisUrl: string;
};

export function createQueueConfig(env: NodeJS.ProcessEnv): QueueConfig {
  return {
    prefix: env.QUEUE_PREFIX ?? "grasp",
    redisUrl: env.QUEUE_REDIS_URL ?? "redis://localhost:6379",
  };
}

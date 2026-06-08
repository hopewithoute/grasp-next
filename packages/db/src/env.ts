import { parse, urlString, v } from '@grasp/domain';

const envSchema = v.object({
  DATABASE_URL: v.optional(urlString),
});

export const env = parse(envSchema, process.env);

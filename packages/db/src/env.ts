import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);

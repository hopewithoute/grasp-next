import { join } from 'node:path';
import { cwd, loadEnvFile } from 'node:process';
import { defineConfig } from 'drizzle-kit';
import { env } from './src/env';

for (const envFile of [join(cwd(), '.env'), join(cwd(), '..', '..', '.env')]) {
  try {
    loadEnvFile(envFile);
    break;
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }
}

const databaseUrl = env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for Drizzle commands.');
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});

function isMissingFileError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

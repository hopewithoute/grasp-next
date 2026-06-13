import { join } from 'node:path';
import { cwd, loadEnvFile } from 'node:process';

export function loadAiEnv() {
  const candidateEnvFiles = [
    join(cwd(), '.env'),
    join(cwd(), '..', '..', '.env'),
    join(cwd(), '..', '..', '..', '.env'),
    join(cwd(), '..', '..', '..', '..', '.env'),
    join(cwd(), '..', '..', '..', '..', '..', '.env'),
  ];

  for (const envFile of candidateEnvFiles) {
    try {
      loadEnvFile(envFile);
      if (process.env.MASTRA_STORAGE_URL) {
        break;
      }
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  }
}

function isMissingFileError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

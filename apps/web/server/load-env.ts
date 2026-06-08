import 'server-only';
import { join } from 'node:path';
import { cwd, loadEnvFile } from 'node:process';

const candidateEnvFiles = [
  join(/* turbopackIgnore: true */ cwd(), '.env'),
  join(/* turbopackIgnore: true */ cwd(), '..', '..', '.env'),
];

for (const envFile of candidateEnvFiles) {
  try {
    loadEnvFile(envFile);
    break;
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }
}

function isMissingFileError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

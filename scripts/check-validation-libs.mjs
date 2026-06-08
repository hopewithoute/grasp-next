import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const blocked = [/\bfrom\s+['"]zod['"]/, /\bfrom\s+['"]arktype['"]/, /"zod"\s*:/, /"arktype"\s*:/];
const scanRoots = ['apps', 'packages'];
const scanRootFiles = ['package.json'];
const ignoredDirs = new Set(['.mastra', '.next', 'dist', 'node_modules']);
const ignoredFiles = new Set(['pnpm-lock.yaml', 'tsconfig.tsbuildinfo']);
const extensions = new Set(['.js', '.jsx', '.json', '.ts', '.tsx']);

function extensionOf(path) {
  const index = path.lastIndexOf('.');
  return index === -1 ? '' : path.slice(index);
}

function walk(path, files) {
  const stat = statSync(path);

  if (stat.isDirectory()) {
    const name = path.split('/').pop();
    if (name && ignoredDirs.has(name)) return files;

    for (const entry of readdirSync(path)) {
      walk(join(path, entry), files);
    }

    return files;
  }

  if (ignoredFiles.has(path.split('/').pop() ?? '')) return files;
  if (!extensions.has(extensionOf(path))) return files;

  files.push(path);
  return files;
}

const files = [
  ...scanRootFiles.map((file) => join(root, file)),
  ...scanRoots.flatMap((dir) => walk(join(root, dir), [])),
];

const violations = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    if (blocked.some((pattern) => pattern.test(line))) {
      violations.push(`${relative(root, file)}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error('First-party validation must use Valibot, not Zod or Arktype:');
  console.error(violations.join('\n'));
  process.exit(1);
}

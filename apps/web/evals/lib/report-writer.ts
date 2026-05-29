import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EvalReport } from './types';

const reportsDir = join(process.cwd(), 'evals/reports');

export async function writeEvalReport(report: EvalReport) {
  const agentDir = join(reportsDir, report.agent);
  await mkdir(agentDir, { recursive: true });

  const filename = `${report.timestamp.replace(/[:.]/g, '-')}-${report.mode}.json`;
  const reportPath = join(agentDir, filename);
  const latestPath = join(agentDir, `latest-${report.mode}.json`);
  const json = `${JSON.stringify(report, null, 2)}\n`;

  await writeFile(reportPath, json);
  await writeFile(latestPath, json);
  if (report.mode === 'fixture') {
    await writeFile(join(agentDir, 'latest.json'), json);
  }

  return { latestPath, reportPath };
}

export async function readEvalReport(agent: string, target = 'latest') {
  const reportPath = target === 'latest' ? join(reportsDir, agent, 'latest-fixture.json') : target;

  return JSON.parse(await readFile(reportPath, 'utf8')) as EvalReport;
}

import { mastra } from './packages/ai/src/mastra/index';
import { readFile } from 'node:fs/promises';

async function main() {
  const agent = mastra.getAgent('refinementAgent');
  const fixture = JSON.parse(await readFile('./apps/web/fixtures/refinement-agent/cases.json', 'utf8'));
  const testCase = fixture.cases.find(c => c.id === 'batch-mixed-actions');
  
  if (!testCase) {
    console.log("TestCase not found");
    return;
  }

  const result = await agent.stream(testCase.messages, { maxSteps: 10 });
  const reader = (result.fullStream).getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  console.log("CHUNKS:", JSON.stringify(chunks, null, 2));
}

main().catch(console.error);

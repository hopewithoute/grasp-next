import { test } from 'vitest';
import { Step, Workflow } from '@mastra/core';

test('writer stream', async () => {
  const step1 = new Step({
    id: 'step1',
    execute: async ({ writer }) => {
      writer?.write({ custom_event: "hello" });
      return { ok: true };
    }
  });

  const wf = new Workflow({ name: "wf", triggerSchema: {} }).step(step1).commit();
  const run = await wf.createRun();
  const stream = await run.stream({ triggerData: {} } as any);
  
  for await (const chunk of stream) {
    if (chunk.type !== 'workflow-step-start' && chunk.type !== 'workflow-start' && chunk.type !== 'workflow-finish') {
      console.log(JSON.stringify(chunk, null, 2));
    }
  }
});

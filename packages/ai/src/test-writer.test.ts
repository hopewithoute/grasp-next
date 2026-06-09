import { test } from 'vitest';
import { Workflow } from '@mastra/core';

// try dynamic import or whatever Mastra uses
import { createStep } from '@mastra/core';

test('writer stream', async () => {
  const step1 = createStep({
    id: 'step1',
    execute: async ({ writer }) => {
      writer?.write({ type: "custom_event" });
      return { type: 'custom_result' };
    }
  });

  const wf = new Workflow({ name: "wf", triggerSchema: {} as any }).step(step1).commit();
  const run = await wf.createRun();
  const stream = await run.stream({ triggerData: {} } as any);
  
  for await (const chunk of stream) {
    if (chunk.type !== 'workflow-step-start' && chunk.type !== 'workflow-start' && chunk.type !== 'workflow-finish') {
      console.log("CHUNK TYPE:", chunk.type);
      console.log(JSON.stringify(chunk, null, 2));
    }
  }
});

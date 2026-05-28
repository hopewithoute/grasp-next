/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it, before, after } from 'node:test';
import { createDbClient, createKnowledgebaseRepository, eq, schema } from '@grasp/db';
import { refinementAgent, createRefinementTools } from '@grasp/ai/refinement';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const hasLlm = Boolean(
  process.env.OPENAI_API_KEY ||
  process.env.ANTHROPIC_API_KEY ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GEMINI_API_KEY
);
const shouldRun = hasDatabase && hasLlm;

describe('Refinement Agent - Real Provider (Graph Proposals)', { skip: !shouldRun }, () => {
  let db: ReturnType<typeof createDbClient>;
  let repo: ReturnType<typeof createKnowledgebaseRepository>;
  let projectId: string;
  let ownerId: string;

  before(async () => {
    db = createDbClient(process.env.DATABASE_URL!);
    repo = createKnowledgebaseRepository(db);
    
    ownerId = randomUUID();
    projectId = randomUUID();
    
    const now = new Date();
    await db.insert(schema.user).values({ id: ownerId, email: `test-refinement-${Date.now()}@example.com`, name: 'Test', createdAt: now, updatedAt: now });
    await db.insert(schema.projects).values({ id: projectId, title: 'Test Project', ownerId, createdAt: now, updatedAt: now });
    
    await db.insert(schema.knowledgebases).values({ projectId });

    // Seed a concept
    await repo.addConcept({
      projectId,
      conceptKey: 'react',
      name: 'React',
      definition: 'A UI library',
      difficulty: 'beginner',
      confidence: 1.0,
    });
  });

  after(async () => {
    // Cleanup
    if (db) {
       await db.delete(schema.projects).where(eq(schema.projects.id, projectId));
       await db.delete(schema.user).where(eq(schema.user.id, ownerId));
    }
  });

  it('can process user chat correction as a TEXT evidence proposal', async () => {
    const proposalCalls: any[] = [];
    const tools = createRecordingRefinementTools({ repo, projectId, proposalCalls });

    const messages = [
      {
        role: 'system',
        content:
          'You are an agent. You MUST use the "propose-graph-changes" tool. Propose exactly one add_evidence action with conceptKey="react", sourceType="text", title="User Chat Correction", evidenceText="React was originally created by Facebook in 2013", and rationale explaining that the quote identifies React origin. Do not use any direct mutation tool.',
      },
      { role: 'user', content: 'Please draft the evidence proposal now.' },
    ];

    const result = await refinementAgent.stream(messages, {
      toolsets: { refinement: tools },
      maxSteps: 5,
    });

    for await (const chunk of result.textStream) {
      if (chunk) {
        continue;
      }
    }

    assertAddEvidenceProposal(proposalCalls, {
      conceptKey: 'react',
      sourceType: 'text',
      title: 'User Chat Correction',
      evidenceText: /Facebook in 2013/i,
    });
  });

  it('can process web URL as a WEB evidence proposal', async () => {
    const proposalCalls: any[] = [];
    const tools = createRecordingRefinementTools({ repo, projectId, proposalCalls });

    const messages = [
      {
        role: 'system',
        content:
          'You are an agent. You MUST use the "propose-graph-changes" tool. Propose exactly one add_evidence action with conceptKey="react", sourceType="web", url="https://react.dev", title="React Official Site", evidenceText="The library for web and native user interfaces", and rationale explaining that this supports React as a UI library. Do not use any direct mutation tool.',
      },
      { role: 'user', content: 'Please draft the web evidence proposal now.' },
    ];

    const result = await refinementAgent.stream(messages, {
      toolsets: { refinement: tools },
      maxSteps: 5,
    });

    for await (const chunk of result.textStream) {
      if (chunk) {
        continue;
      }
    }

    assertAddEvidenceProposal(proposalCalls, {
      conceptKey: 'react',
      sourceType: 'web',
      title: 'React Official Site',
      url: 'https://react.dev',
      evidenceText: /web and native user interfaces/i,
    });
  });
});

function createRecordingRefinementTools({
  repo,
  projectId,
  proposalCalls,
}: {
  repo: ReturnType<typeof createKnowledgebaseRepository>;
  projectId: string;
  proposalCalls: any[];
}) {
  const tools = createRefinementTools({ knowledgebaseRepository: repo, projectId }) as any;
  const proposalTool = tools['propose-graph-changes'];
  const originalExecute = proposalTool.execute.bind(proposalTool);

  tools['propose-graph-changes'] = {
    ...proposalTool,
    execute: async (...args: any[]) => {
      proposalCalls.push(args[0]);
      return originalExecute(...args);
    },
  };
  tools.proposeGraphChangesTool = tools['propose-graph-changes'];

  return tools;
}

function assertAddEvidenceProposal(
  proposalCalls: any[],
  expected: {
    conceptKey: string;
    evidenceText: RegExp;
    sourceType: string;
    title: string;
    url?: string;
  }
) {
  assert.ok(proposalCalls.length > 0, 'Expected agent to call propose-graph-changes');
  const proposal = proposalCalls.at(-1);
  assert.ok(typeof proposal.rationale === 'string' && proposal.rationale.length > 0);

  const evidenceActions = proposal.actions.filter((action: any) => action.type === 'add_evidence');
  assert.equal(evidenceActions.length, 1, 'Expected exactly one add_evidence action');

  const payload = evidenceActions[0].payload;
  assert.equal(payload.conceptKey, expected.conceptKey);
  assert.equal(payload.sourceType, expected.sourceType);
  assert.equal(payload.title, expected.title);
  assert.match(payload.evidenceText, expected.evidenceText);

  if (expected.url) {
    assert.equal(payload.url, expected.url);
  }
}

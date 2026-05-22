import { MockMemory } from '@mastra/core/memory';
import type { StorageThreadType } from '@mastra/core/memory';

export class StudioMemory extends MockMemory {
  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const existingThread = await super.getThreadById({ threadId });

    if (existingThread) {
      return existingThread;
    }

    const now = new Date();
    return this.saveThread({
      thread: {
        createdAt: now,
        id: threadId,
        metadata: {},
        resourceId: '',
        title: '',
        updatedAt: now,
      },
    });
  }
}

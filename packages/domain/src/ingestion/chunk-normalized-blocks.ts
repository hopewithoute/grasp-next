import type { NormalizedSourceBlockDto } from '../sources';

export type IngestionChunk = {
  chunkIndex: number;
  blocks: NormalizedSourceBlockDto[];
  text: string;
};

const DEFAULT_MAX_CHUNK_TOKENS = 2500;
const APPROX_CHARS_PER_TOKEN = 4;

/**
 * Splits normalized source blocks into chunks that fit within a token budget.
 * Splits on block boundaries (never mid-block). Headings start new chunks
 * when the current chunk is already non-trivial.
 */
export function chunkNormalizedBlocks(
  blocks: NormalizedSourceBlockDto[],
  maxChunkTokens = DEFAULT_MAX_CHUNK_TOKENS
): IngestionChunk[] {
  const maxChars = maxChunkTokens * APPROX_CHARS_PER_TOKEN;
  const chunks: IngestionChunk[] = [];
  let current: NormalizedSourceBlockDto[] = [];
  let currentChars = 0;

  for (const block of blocks) {
    const blockChars = block.text.length;
    const wouldExceed = currentChars + blockChars > maxChars && current.length > 0;
    const isHeadingBreak = block.kind === 'heading' && currentChars > maxChars * 0.3;

    if (wouldExceed || isHeadingBreak) {
      chunks.push(buildChunk(chunks.length, current));
      current = [];
      currentChars = 0;
    }

    current.push(block);
    currentChars += blockChars;
  }

  if (current.length > 0) {
    chunks.push(buildChunk(chunks.length, current));
  }

  return chunks;
}

function buildChunk(index: number, blocks: NormalizedSourceBlockDto[]): IngestionChunk {
  return {
    blocks,
    chunkIndex: index,
    text: blocks.map((b) => b.text).join('\n\n'),
  };
}

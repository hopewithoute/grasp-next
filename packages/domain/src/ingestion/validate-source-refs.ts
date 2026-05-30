import type { IngestionSourceRef } from '../index';

export type SourceBlockForValidation = {
  id: string;
  text: string;
};

/**
 * Validate each ref's quote against the chunk's block texts. The agent's claimed
 * blockId is checked first; if the quote is not a substring there, we search across
 * all chunk blocks and rebind the ref to whichever block actually contains the quote.
 * Refs whose quote cannot be located in any block are dropped — no grounding, no ref.
 */
export function validateAndAnchorSourceRefs(
  refs: IngestionSourceRef[],
  blocks: SourceBlockForValidation[]
): IngestionSourceRef[] {
  const validated: IngestionSourceRef[] = [];
  const blockById = new Map(blocks.map((block) => [block.id, block]));

  for (const ref of refs) {
    const quote = ref.quote.trim();
    if (!quote) continue;

    const claimed = blockById.get(ref.blockId);
    if (claimed && claimed.text.includes(quote)) {
      validated.push({ ...ref, quote });
      continue;
    }

    const fallback = blocks.find((block) => block.text.includes(quote));
    if (fallback) {
      validated.push({ ...ref, blockId: fallback.id, quote });
      continue;
    }

    // No block contains the quote — drop the ref.
  }

  return validated;
}

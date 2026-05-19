import { normalizedSourceDto, type NormalizedSourceBlockDto } from './normalized-source.dto';

const headingPattern = /^(#{1,6})\s+(.+)$/;
const unorderedListPattern = /^\s*[-*+]\s+.+$/;
const orderedListPattern = /^\s*\d+\.\s+.+$/;
const tablePattern = /^\s*\|.+\|\s*$/;

export type NormalizeMarkdownSourceInput = {
  sourceId: string;
  sourceMaterial: string;
  title: string;
};

export function normalizeMarkdownSource(input: NormalizeMarkdownSourceInput) {
  const blocks = splitMarkdownBlocks(input.sourceMaterial).map((rawBlock, index) =>
    buildNormalizedBlock(rawBlock, index, input.sourceId)
  );

  return normalizedSourceDto.parse({
    blocks,
    id: input.sourceId,
    sourceType: detectMarkdownSyntax(input.sourceMaterial) ? 'markdown' : 'text',
    title: input.title,
  });
}

function splitMarkdownBlocks(sourceMaterial: string) {
  return sourceMaterial
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function buildNormalizedBlock(
  rawBlock: string,
  index: number,
  sourceId: string
): NormalizedSourceBlockDto {
  const order = index;
  const heading = rawBlock.match(headingPattern);

  if (heading) {
    const depth = heading[1]?.length ?? 1;
    const text = heading[2]?.trim() ?? rawBlock;

    return {
      id: buildBlockId(order),
      kind: 'heading',
      location: { label: `Heading ${index + 1}` },
      metadata: { depth },
      order,
      sourceId,
      text,
    };
  }

  return {
    id: buildBlockId(order),
    kind: inferBlockKind(rawBlock),
    location: { label: `Block ${index + 1}` },
    order,
    sourceId,
    text: rawBlock,
  };
}

function inferBlockKind(rawBlock: string): NormalizedSourceBlockDto['kind'] {
  const lines = rawBlock.split('\n').filter(Boolean);

  if (lines.every((line) => unorderedListPattern.test(line) || orderedListPattern.test(line))) {
    return 'list';
  }

  if (lines.length > 1 && lines.every((line) => tablePattern.test(line))) {
    return 'table';
  }

  if (rawBlock.startsWith('```')) {
    return 'code';
  }

  return 'paragraph';
}

function detectMarkdownSyntax(sourceMaterial: string) {
  return sourceMaterial
    .split('\n')
    .some(
      (line) =>
        headingPattern.test(line) ||
        unorderedListPattern.test(line) ||
        orderedListPattern.test(line) ||
        tablePattern.test(line)
    );
}

function buildBlockId(order: number) {
  return `block-${String(order + 1).padStart(4, '0')}`;
}

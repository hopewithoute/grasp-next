import { describe, expect, it } from 'vitest';
import { normalizeMarkdownSource } from './normalize-markdown-source';

describe('normalizeMarkdownSource', () => {
  it('normalizes headings, paragraphs, and lists into one source contract', () => {
    const source = normalizeMarkdownSource({
      sourceId: 'project-source-current',
      sourceMaterial: [
        '# Database Indexing',
        '',
        'Indexes help databases find rows without scanning every row.',
        '',
        '- B-tree indexes keep keys sorted.',
        '- Hash indexes support equality lookup.',
      ].join('\n'),
      title: 'Database Lesson',
    });

    expect(source.sourceType).toBe('markdown');
    expect(source.blocks.map((block) => block.kind)).toEqual(['heading', 'paragraph', 'list']);
    expect(source.blocks[0]?.text).toBe('Database Indexing');
    expect(source.blocks[0]?.metadata?.depth).toBe(1);
    expect(source.blocks[1]?.location.label).toBe('Block 2');
  });

  it('treats plain pasted text as the same normalized source contract', () => {
    const source = normalizeMarkdownSource({
      sourceId: 'project-source-current',
      sourceMaterial: 'Markets coordinate supply and demand.\n\nPrices carry information.',
      title: 'Economics',
    });

    expect(source.sourceType).toBe('text');
    expect(source.blocks.map((block) => block.kind)).toEqual(['paragraph', 'paragraph']);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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

    assert.equal(source.sourceType, 'markdown');
    assert.deepEqual(
      source.blocks.map((block) => block.kind),
      ['heading', 'paragraph', 'list']
    );
    assert.equal(source.blocks[0]?.text, 'Database Indexing');
    assert.equal(source.blocks[0]?.metadata?.depth, 1);
    assert.equal(source.blocks[1]?.location.label, 'Block 2');
  });

  it('treats plain pasted text as the same normalized source contract', () => {
    const source = normalizeMarkdownSource({
      sourceId: 'project-source-current',
      sourceMaterial: 'Markets coordinate supply and demand.\n\nPrices carry information.',
      title: 'Economics',
    });

    assert.equal(source.sourceType, 'text');
    assert.deepEqual(
      source.blocks.map((block) => block.kind),
      ['paragraph', 'paragraph']
    );
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateAndAnchorSourceRefs } from './validate-source-refs';

const blocks = [
  { id: 'block-0001', text: 'Markets coordinate buyers and sellers through prices.' },
  { id: 'block-0002', text: 'When demand exceeds supply, prices rise.' },
];

describe('validateAndAnchorSourceRefs', () => {
  it('keeps refs whose quote is verbatim in the claimed block', () => {
    const result = validateAndAnchorSourceRefs(
      [
        {
          blockId: 'block-0001',
          locationLabel: 'Block 1',
          quote: 'Markets coordinate buyers and sellers through prices.',
        },
      ],
      blocks
    );

    assert.equal(result.length, 1);
    assert.equal(result[0]?.blockId, 'block-0001');
  });

  it('rebinds refs to the actual block when agent picked the wrong blockId', () => {
    const result = validateAndAnchorSourceRefs(
      [
        {
          blockId: 'block-0001',
          locationLabel: 'Block 1',
          quote: 'When demand exceeds supply, prices rise.',
        },
      ],
      blocks
    );

    assert.equal(result.length, 1);
    assert.equal(result[0]?.blockId, 'block-0002');
  });

  it('drops refs whose quote does not appear in any block', () => {
    const result = validateAndAnchorSourceRefs(
      [
        {
          blockId: 'block-0001',
          locationLabel: 'Block 1',
          quote: 'Demand and supply equilibrate at every price.',
        },
      ],
      blocks
    );

    assert.equal(result.length, 0);
  });

  it('drops refs with empty quotes', () => {
    const result = validateAndAnchorSourceRefs(
      [
        {
          blockId: 'block-0001',
          locationLabel: 'Block 1',
          quote: '   ',
        },
      ],
      blocks
    );

    assert.equal(result.length, 0);
  });

  it('trims whitespace around quotes before substring check', () => {
    const result = validateAndAnchorSourceRefs(
      [
        {
          blockId: 'block-0001',
          locationLabel: 'Block 1',
          quote: '  Markets coordinate buyers and sellers through prices.  ',
        },
      ],
      blocks
    );

    assert.equal(result.length, 1);
    assert.equal(
      result[0]?.quote,
      'Markets coordinate buyers and sellers through prices.'
    );
  });
});

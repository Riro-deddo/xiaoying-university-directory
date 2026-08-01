import { describe, expect, it } from 'vitest';
import { stateCopy, sourceHealthCopy } from '../src/lib/presentation';

describe('stateCopy', () => {
  it('uses neutral language for unpublished information', () => {
    expect(stateCopy['not-public'].label).toBe('未发现公开 List');
    expect(stateCopy.pending.description).toContain('不代表学校不接受申请');
  });

  it('preserves official List terminology in Chinese labels', () => {
    expect(stateCopy['official-list'].label).toBe('公开院校 List');
  });
});

describe('sourceHealthCopy', () => {
  it('does not describe a temporary error as a permanent broken link', () => {
    expect(sourceHealthCopy['temporary-error']).toBe('暂时无法检查');
  });
});

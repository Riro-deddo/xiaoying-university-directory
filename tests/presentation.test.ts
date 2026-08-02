import { describe, expect, it } from 'vitest';
import {
  directoryFilters,
  evidenceStateCopy,
  sourceFreshnessCopy,
  stateCopy,
  sourceHealthCopy,
} from '../src/lib/presentation';

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

describe('directoryFilters', () => {
  it('reuses the neutral state label in the public filter', () => {
    expect(directoryFilters.find(([value]) => value === 'not-public')?.[1])
      .toBe('未发现公开 List');
  });
});

describe('sourceFreshnessCopy', () => {
  it('prefers the most recent successful check date', () => {
    expect(sourceFreshnessCopy({
      sourceId: 'example',
      health: 'ok',
      checkedAt: '2026-08-02T08:00:00.000Z',
      lastSuccessfulAt: '2026-08-01T08:00:00.000Z',
    })).toBe('最近成功检查：2026-08-01');
  });

  it('falls back to the latest attempted check date', () => {
    expect(sourceFreshnessCopy({
      sourceId: 'example',
      health: 'temporary-error',
      checkedAt: '2026-08-02T08:00:00.000Z',
    })).toBe('最近检查：2026-08-02');
  });

  it('states when no check time is available', () => {
    expect(sourceFreshnessCopy()).toBe('尚无检查时间');
  });
});

describe('evidenceStateCopy', () => {
  it('keeps faculty scope and every non-eligibility evidence status distinct', () => {
    expect(evidenceStateCopy['faculty-match'].label).toBe('院系/专业范围内找到');
    expect(evidenceStateCopy['not-found-in-public-list'].label).toBe('公开 List 中暂未找到');
    expect(evidenceStateCopy['no-public-list'].label).toBe('未发现公开 List');
    expect(evidenceStateCopy['source-changed'].label).toBe('来源已变更');
    expect(evidenceStateCopy['source-unavailable'].label).toBe('来源暂不可用');
    expect(Object.values(evidenceStateCopy).flatMap((copy) => [copy.label, copy.description]).join('')).not.toMatch(/可以申请|不能申请|保底|冲刺/);
  });
});

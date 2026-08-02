import { describe, expect, it } from 'vitest';
import {
  directoryFilters,
  evidenceStateCopy,
  institutionRuleTypeCopy,
  officialPanelTitle,
  sourceFreshnessCopy,
  stateCopy,
  sourceHealthCopy,
} from '../src/lib/presentation';

describe('stateCopy', () => {
  it('uses neutral language for unpublished information', () => {
    expect(stateCopy['not-public'].label).toBe('未发现院校规则');
    expect(stateCopy.pending.description).toContain('不代表学校不接受申请');
  });

  it('labels the public state as institution rules rather than one kind of List', () => {
    expect(stateCopy['official-list'].label).toBe('有中国院校规则');
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
      .toBe('未发现院校规则');
  });
});

describe('institution rule presentation', () => {
  it('uses distinct Chinese labels for eligibility, grade, mixed, and no-list rules', () => {
    expect(institutionRuleTypeCopy.eligibility.label).toBe('院校准入限制');
    expect(institutionRuleTypeCopy['grade-threshold'].label).toBe('院校成绩分档');
    expect(institutionRuleTypeCopy.mixed.label).toBe('准入与成绩混合规则');
    expect(institutionRuleTypeCopy.none.label).toBe('未发现院校名单');
  });

  it('uses rule-specific folded panel titles', () => {
    expect(officialPanelTitle('eligibility', 12)).toBe('查看官方院校准入名单（12 所）');
    expect(officialPanelTitle('grade-threshold', 84)).toBe('查看官方院校成绩分档（84 所）');
    expect(officialPanelTitle('mixed', 81)).toBe('查看官方 Priority List（81 所）');
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

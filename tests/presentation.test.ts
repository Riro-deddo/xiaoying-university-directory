import { describe, expect, it } from 'vitest';
import {
  directoryRankCopy,
  directoryFilters,
  evidenceCopyFor,
  evidenceStateCopy,
  institutionRuleTypeCopy,
  officialPanelTitle,
  sourceFreshnessCopy,
  stateCopy,
  sourceHealthCopy,
} from '../src/lib/presentation';
import type { UniversityWithStatus } from '../src/lib/types';

const gradeThresholdRule = {
  type: 'grade-threshold' as const,
  summaryZh: '院校决定成绩门槛。',
  listedMeaningZh: '名单内使用较低门槛。',
  unlistedMeaningZh: '名单外认可院校使用较高门槛。',
};

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

describe('directoryRankCopy', () => {
  it('renders the specialist label without inventing a QS rank', () => {
    const specialist: UniversityWithStatus = {
      id: 'london-business-school',
      nameZh: '伦敦商学院',
      nameEn: 'London Business School',
      aliases: ['LBS'],
      directoryCategory: 'specialist',
      state: 'not-public',
      officialDomain: 'https://www.london.edu',
      sources: [],
    };
    expect(directoryRankCopy(specialist)).toBe('专业院校');
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

  it('describes a grade-threshold match without calling it permission to apply', () => {
    const copy = evidenceCopyFor({
      state: 'official-match',
      institutionRule: gradeThresholdRule,
    });

    expect(copy.label).toBe('在官方院校成绩分档中找到');
    expect(copy.description).toBe(gradeThresholdRule.listedMeaningZh);
    expect(`${copy.label}${copy.description}`).not.toMatch(/可以申请|不能申请/);
  });

  it('uses the reviewed unlisted meaning for a structured miss', () => {
    const copy = evidenceCopyFor({
      state: 'not-found-in-public-list',
      institutionRule: gradeThresholdRule,
    });

    expect(copy.description).toBe(gradeThresholdRule.unlistedMeaningZh);
  });

  it('does not apply an unlisted conclusion to an unparsed source', () => {
    const copy = evidenceCopyFor({ state: 'no-public-list', institutionRule: gradeThresholdRule });

    expect(copy.description).toContain('暂未完成安全结构化');
    expect(copy.description).not.toBe(gradeThresholdRule.unlistedMeaningZh);
  });
});

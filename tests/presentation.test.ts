import { describe, expect, it } from 'vitest';
import {
  directoryRankCopy,
  directoryFilters,
  evidenceCopyFor,
  evidenceStateCopy,
  institutionRuleTypeCopy,
  officialPanelTitle,
  rankingCopy,
  strengthEvidenceCopy,
  sourceFreshnessCopy,
  stateCopy,
  sourceHealthCopy,
} from '../src/lib/presentation';
import type { RankingRecord, UniversityWithStatus } from '../src/lib/types';

const gradeThresholdRule = {
  type: 'grade-threshold' as const,
  summaryZh: '院校决定成绩门槛。',
  listedMeaningZh: '名单内使用较低门槛。',
  unlistedMeaningZh: '名单外认可院校使用较高门槛。',
};

describe('stateCopy', () => {
  it('uses neutral language for unpublished information', () => {
    expect(stateCopy['not-public'].label).toBe('未发现院校规则');
    expect(stateCopy.pending).toEqual({
      label: '官网暂无可核验规则',
      description: '已核查当前公开官网，但信息不足以确认中国学历或院校限制；不代表学校没有内部规则，也不代表不能申请。',
    });
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
    expect(directoryFilters).toContainEqual(['pending', '官网暂无可核验规则']);
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
      rankings: {},
    };
    expect(directoryRankCopy(specialist)).toBe('专业院校');
  });
});

describe('strengthEvidenceCopy', () => {
  it('renders an exact global subject rank', () => {
    expect(strengthEvidenceCopy({
      kind: 'subject-ranking',
      provider: 'qs',
      rankingName: 'QS World University Rankings by Subject',
      subjectZh: '艺术与设计',
      edition: 2026,
      placement: 'exact',
      displayRank: '1',
      sourceUrl: 'https://example.test/rca',
      noteZh: '专业院校，不参与综合大学排序',
    })).toBe('QS 2026 艺术与设计全球第 1 · 专业院校，不参与综合大学排序');
  });

  it('renders a global band without inventing an ordinal', () => {
    expect(strengthEvidenceCopy({
      kind: 'subject-ranking',
      provider: 'shanghai',
      rankingName: 'ShanghaiRanking Global Ranking of Academic Subjects',
      subjectZh: '公共卫生',
      edition: 2025,
      placement: 'band',
      displayRank: '76–100',
      sourceUrl: 'https://example.test/lstm',
      noteZh: '专业院校，不参与综合大学排序',
    })).toBe('软科 2025 公共卫生全球 76–100 · 专业院校，不参与综合大学排序');
  });

  it('labels a derived REF result as a UK analysis rather than a global ranking', () => {
    expect(strengthEvidenceCopy({
      kind: 'research-assessment',
      provider: 'ref',
      rankingName: 'Research Excellence Framework 2021',
      subjectZh: '生物科学',
      edition: 2021,
      placement: 'derived-national-exact',
      displayRank: '1',
      sourceUrl: 'https://example.test/icr',
      noteZh: '不是全球学科榜',
    })).toBe('REF 2021 结果加权分析：生物科学英国第 1 · 不是全球学科榜');
  });
});

describe('rankingCopy', () => {
  it.each([
    [{ placement: 'exact', displayRank: '88', sortRank: 88 }, '88'],
    [{ placement: 'tied', displayRank: '=42', sortRank: 42 }, '=42'],
    [{ placement: 'band', displayRank: '201–250', sortRank: 201 }, '201–250'],
    [{ placement: 'unranked' }, '当期未上榜'],
    [{ placement: 'unverified' }, '暂未核实'],
  ])('renders %o as %s without inferring application eligibility', (record, expected) => {
    expect(rankingCopy({ universityId: 'example', provider: 'the', edition: 2026, ...record } as RankingRecord))
      .toBe(expected);
  });

  it('treats an absent ranking as unverified rather than unranked', () => {
    expect(rankingCopy()).toBe('暂未核实');
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
    expect(officialPanelTitle('eligibility', 12)).toBe('查看官方院校准入名单（12 条规则记录）');
    expect(officialPanelTitle('grade-threshold', 84)).toBe('查看官方院校成绩分档（84 条规则记录）');
    expect(officialPanelTitle('mixed', 81)).toBe('查看官方 Priority List（81 条规则记录）');
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

import { describe, expect, it } from 'vitest';
import { buildOfficialListDisplays } from '../src/lib/official-list-display';
import type {
  InstitutionRecord,
  RequirementFact,
  SourceWithStatus,
  UniversityWithStatus,
} from '../src/lib/types';

const structuredSource: SourceWithStatus = {
  id: 'ucl-china',
  universityId: 'university-college-london',
  labelZh: '中国研究生入学要求',
  url: 'https://www.ucl.ac.uk/prospective-students/international/china',
  kind: 'official-list',
  scope: 'university',
  scopeZh: '全校',
  cycle: '2026/27',
  institutionRule: {
    type: 'grade-threshold',
    summaryZh: '本科院校影响最低成绩门槛。',
    listedMeaningZh: '名单内使用较低成绩门槛。',
    unlistedMeaningZh: '名单外认可院校使用较高成绩门槛。',
    caveatZh: '具体课程可能要求更高。',
  },
  parser: {
    mode: 'html-list',
    guard: { minimumRecords: 1, maximumRecords: 100, maximumRemovalRatio: 0.2 },
  },
};

const linkOnlySource: SourceWithStatus = {
  ...structuredSource,
  id: 'southampton-china',
  universityId: 'university-of-southampton',
  labelZh: '中国院校 Tier 名单',
  parser: {
    mode: 'link-only',
    guard: { minimumRecords: 0, maximumRecords: 0, maximumRemovalRatio: 0 },
  },
};

function university(id: string, source: SourceWithStatus): UniversityWithStatus {
  return {
    id,
    nameZh: id,
    nameEn: id,
    aliases: [],
    qs: { edition: 2027, rank: 1 },
    state: 'official-list',
    officialDomain: 'https://example.edu',
    sources: [source],
  };
}

const beihang: InstitutionRecord = {
  id: 'beihang-university',
  nameZh: '北京航空航天大学',
  nameEn: 'Beihang University',
  aliases: [],
};

const peking: InstitutionRecord = {
  id: 'peking-university',
  nameZh: '北京大学',
  nameEn: 'Peking University',
  aliases: [],
};

function fact(
  id: string,
  institutionId: string,
  extractedAt: string,
  source: SourceWithStatus = structuredSource,
): RequirementFact {
  return {
    id,
    universityId: source.universityId,
    sourceId: source.id,
    institutionId,
    tierOfficial: 'Group A',
    scoreOfficial: '85%',
    scope: source.scope,
    scopeZh: source.scopeZh,
    cycle: source.cycle,
    extractedAt,
    contentHash: 'a'.repeat(64),
  };
}

describe('official List presentation model', () => {
  it('groups guarded facts by university and source and sorts rows by Chinese name', () => {
    const displays = buildOfficialListDisplays({
      universities: [university(structuredSource.universityId, structuredSource)],
      institutions: [peking, beihang],
      requirements: [
        fact('peking', peking.id, '2026-07-01T00:00:00.000Z'),
        fact('beihang', beihang.id, '2026-08-01T00:00:00.000Z'),
      ],
    });

    expect(displays.get(structuredSource.universityId)?.[0].rows.map((row) => row.nameZh)).toEqual([
      '北京大学',
      '北京航空航天大学',
    ]);
    expect(displays.get(structuredSource.universityId)?.[0]).toMatchObject({
      sourceId: 'ucl-china',
      sourceLabelZh: '中国研究生入学要求',
      cycle: '2026/27',
      extractedAt: '2026-08-01T00:00:00.000Z',
    });
  });

  it('does not create a panel for a link-only source without accepted facts', () => {
    const displays = buildOfficialListDisplays({
      universities: [university(linkOnlySource.universityId, linkOnlySource)],
      institutions: [],
      requirements: [],
    });

    expect(displays.has(linkOnlySource.universityId)).toBe(false);
  });

  it('rejects accepted facts attached to a link-only source', () => {
    expect(() => buildOfficialListDisplays({
      universities: [university(linkOnlySource.universityId, linkOnlySource)],
      institutions: [beihang],
      requirements: [fact('unsafe', beihang.id, '2026-08-01T00:00:00.000Z', linkOnlySource)],
    })).toThrow(/link-only/i);
  });

  it('rejects duplicate institution rows within one source', () => {
    expect(() => buildOfficialListDisplays({
      universities: [university(structuredSource.universityId, structuredSource)],
      institutions: [beihang],
      requirements: [
        fact('first', beihang.id, '2026-08-01T00:00:00.000Z'),
        fact('duplicate', beihang.id, '2026-08-01T00:00:00.000Z'),
      ],
    })).toThrow(/duplicate institution/i);
  });

  it('carries grade-threshold meaning and exact scope into a folded panel', () => {
    const panel = buildOfficialListDisplays({
      universities: [university(structuredSource.universityId, structuredSource)],
      institutions: [beihang],
      requirements: [fact('beihang', beihang.id, '2026-08-01T00:00:00.000Z')],
    }).get(structuredSource.universityId)?.[0];

    expect(panel).toMatchObject({
      ruleType: 'grade-threshold',
      ruleSummaryZh: structuredSource.institutionRule.summaryZh,
      listedMeaningZh: structuredSource.institutionRule.listedMeaningZh,
      unlistedMeaningZh: structuredSource.institutionRule.unlistedMeaningZh,
      scope: 'university',
    });
  });

  it('supports a safely structured faculty rule without making it university-wide', () => {
    const faculty: SourceWithStatus = {
      ...structuredSource,
      id: 'faculty-rule',
      kind: 'faculty-page',
      scope: 'faculty',
      scopeZh: '商学院硕士项目',
    };
    const panel = buildOfficialListDisplays({
      universities: [university(faculty.universityId, faculty)],
      institutions: [beihang],
      requirements: [fact('faculty', beihang.id, '2026-08-01T00:00:00.000Z', faculty)],
    }).get(faculty.universityId)?.[0];

    expect(panel).toMatchObject({ scope: 'faculty', scopeZh: '商学院硕士项目' });
  });

  it('rejects institution facts for a source classified as requirements-only', () => {
    const noListSource: SourceWithStatus = {
      ...structuredSource,
      institutionRule: { type: 'none', summaryZh: '只有一般要求。' },
    };

    expect(() => buildOfficialListDisplays({
      universities: [university(noListSource.universityId, noListSource)],
      institutions: [beihang],
      requirements: [fact('invalid', beihang.id, '2026-08-01T00:00:00.000Z', noListSource)],
    })).toThrow(/requirements-only|institution rule/i);
  });
});

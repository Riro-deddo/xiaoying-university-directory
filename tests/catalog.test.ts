import { describe, expect, it } from 'vitest';
import cohort from '../src/data/qs-2027-top-200-uk.json';
import universities from '../src/data/universities.json';
import sources from '../src/data/sources.json';
import institutions from '../src/data/institutions.json';
import requirements from '../src/data/generated/requirements.json';

describe('QS cohort and official source registry', () => {
  it('freezes only the official QS 2027 UK top-200 cohort', () => {
    expect(cohort.edition).toBe(2027);
    expect(cohort.sourceUrl).toContain('topuniversities.com/world-university-rankings');
    expect(cohort.universities.length).toBeGreaterThan(20);
    expect(cohort.universities.every((item) => item.rank >= 1 && item.rank <= 200)).toBe(true);
    expect(new Set(cohort.universities.map((item) => item.id)).size).toBe(cohort.universities.length);
  });

  it('does not contain universities outside the frozen cohort', () => {
    const cohortIds = new Set(cohort.universities.map((item) => item.id));
    const rankedUniversities = universities.filter((item) => item.directoryCategory === 'qs-top-200');
    expect(rankedUniversities.every((item) => cohortIds.has(item.id))).toBe(true);
  });

  it('covers every frozen cohort university exactly once without pending records', () => {
    const cohortIds = [...cohort.universities.map((item) => item.id)].sort();
    const publicIds = universities
      .filter((item) => item.directoryCategory === 'qs-top-200')
      .map((item) => item.id)
      .sort();

    expect(publicIds).toEqual(cohortIds);
    expect(universities.every((item) => item.state !== 'pending')).toBe(true);
  });

  it('references only explicitly registered official sources', () => {
    const sourceIds = new Set(sources.map((source) => source.id));
    expect(universities.flatMap((item) => item.sourceIds)
      .every((id) => sourceIds.has(id))).toBe(true);
  });

  it('registers and links the LBS Masters in Management source', () => {
    expect(universities.find((item) => item.id === 'london-business-school')?.sourceIds).toEqual(['lbs-mim-entry']);
    expect(sources.find((item) => item.id === 'lbs-mim-entry')).toMatchObject({
      universityId: 'london-business-school',
      url: 'https://www.london.edu/masters-degrees/masters-in-management/apply',
      institutionRule: {
        verification: { reviewedAt: '2026-08-02' },
      },
    });
  });

  it('gives every university an official-domain source', () => {
    const universityById = new Map(universities.map((university) => [university.id, university]));
    const sourceById = new Map(sources.map((source) => [source.id, source]));

    for (const university of universities) {
      expect(university.sourceIds.length).toBeGreaterThan(0);
      for (const sourceId of university.sourceIds) {
        const source = sourceById.get(sourceId);
        expect(source?.universityId).toBe(university.id);
        const sourceHost = new URL(source!.url).hostname;
        const officialHost = new URL(universityById.get(university.id)!.officialDomain).hostname;
        expect(sourceHost === officialHost || sourceHost.endsWith(`.${officialHost}`)).toBe(true);
      }
    }
  });

  it('registers deterministic facts for the three directly published official lists', () => {
    for (const sourceId of ['ucl-china', 'edinburgh-china']) {
      const source = sources.find((item) => item.id === sourceId);
      expect(source?.parser.mode).not.toBe('link-only');
      const facts = requirements.filter((item) => item.sourceId === sourceId);
      expect(facts.length).toBeGreaterThan(0);
      expect(facts.every((fact) => institutions.some((institution) => institution.id === fact.institutionId))).toBe(true);
    }
  });

  it('keeps generated facts refreshable and free from placeholders', () => {
    const sourceById = new Map(sources.map((source) => [source.id, source]));
    const emptyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    expect(requirements.every((fact) => sourceById.get(fact.sourceId)?.parser.mode !== 'link-only')).toBe(true);
    expect(requirements.every((fact) => /^[a-f0-9]{64}$/u.test(fact.contentHash) && fact.contentHash !== emptyHash)).toBe(true);
    const userFacingStrings = [
      ...universities.flatMap((item) => [item.nameZh, item.nameEn, ...item.aliases, 'noteZh' in item ? item.noteZh : undefined]),
      ...sources.flatMap((source) => [
        source.labelZh,
        source.scopeZh,
        source.parser.defaultTierOfficial,
        source.institutionRule.summaryZh,
        source.institutionRule.listedMeaningZh,
        source.institutionRule.unlistedMeaningZh,
        source.institutionRule.caveatZh,
      ]),
      ...institutions.flatMap((institution) => [institution.nameZh, institution.nameEn, ...institution.aliases]),
      ...requirements.flatMap((fact) => [fact.tierOfficial, 'scoreOfficial' in fact ? fact.scoreOfficial : undefined, fact.scopeZh]),
    ].filter((value): value is string => typeof value === 'string');
    expect(userFacingStrings.every((value) => value.trim().length > 0 && !/[?\uFFFD]/u.test(value))).toBe(true);
    for (const source of sources.filter((item) => item.parser.mode !== 'link-only')) {
      const count = requirements.filter((fact) => fact.sourceId === source.id).length;
      expect(count).toBeGreaterThanOrEqual(source.parser.guard.minimumRecords);
      expect(count).toBeLessThanOrEqual(source.parser.guard.maximumRecords);
    }
  });

  it('preserves registered source scope and configured official tiers exactly', () => {
    const sourceById = new Map(sources.map((source) => [source.id, source]));

    for (const fact of requirements) {
      const source = sourceById.get(fact.sourceId)!;
      expect(fact.scope).toBe(source.scope);
      expect(fact.scopeZh).toBe(source.scopeZh);
      expect(fact.tierOfficial).toBe(source.parser.defaultTierOfficial);
      if (source.cycle) expect(fact.cycle).toBe(source.cycle);
    }
  });

  it('keeps accepted parser counts and emits no facts for link-only sources', () => {
    expect(requirements.filter((fact) => fact.sourceId === 'ucl-china')).toHaveLength(84);
    expect(requirements.filter((fact) => fact.sourceId === 'edinburgh-china')).toHaveLength(81);
    expect(requirements.filter((fact) => fact.sourceId === 'sheffield-china')).toHaveLength(0);

    const linkOnlyIds = new Set(sources
      .filter((source) => source.parser.mode === 'link-only')
      .map((source) => source.id));
    expect(requirements.every((fact) => !linkOnlyIds.has(fact.sourceId))).toBe(true);
  });

  it('links Southampton directly to its official tier list without enabling incomplete matching', () => {
    const source = sources.find((item) => item.id === 'southampton-china');

    expect(source?.url).toBe('https://www.southampton.ac.uk/international/entry-qualification-equivalencies/china/postgraduate-taught-tier-list');
    expect(source?.labelZh).toBe('中国院校 Tier 名单');
    expect(source?.cycle).toBe('2025/26');
    expect(source?.parser.mode).toBe('link-only');
  });

  it('distinguishes eligibility, grade-threshold, mixed, and requirements-only sources', () => {
    const ruleType = (sourceId: string) => sources.find((source) => source.id === sourceId)?.institutionRule.type;

    expect(ruleType('ucl-china')).toBe('grade-threshold');
    expect(ruleType('edinburgh-china')).toBe('mixed');
    expect(ruleType('southampton-china')).toBe('grade-threshold');
    expect(ruleType('manchester-law-china')).toBe('none');
  });

  it('records safe listed and unlisted meanings for every source with institution rules', () => {
    for (const source of sources.filter((item) => item.institutionRule.type !== 'none')) {
      expect(source.institutionRule.listedMeaningZh?.trim()).toBeTruthy();
      expect(source.institutionRule.unlistedMeaningZh?.trim()).toBeTruthy();
      expect(source.institutionRule.verification?.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(source.institutionRule.verification?.url).toMatch(/^https:\/\//u);
      expect(source.institutionRule.verification?.requiredText.length).toBeGreaterThan(1);
    }
  });

  it('canonicalizes cross-source English variants without losing exact official names', () => {
    const variants = [
      ['Beihang University (formerly Beijing University of Aeronautics & Astronautics)', 'Beihang University'],
      ['North China Electric Power University / Huabei Electric Power University', 'North China Electric Power University'],
      ['Beijing Jiaotong University (formerly Beifang (Northern) Jiaotong University)', 'Beijing Jiaotong University'],
      ['Beijing Normal University (see note regarding United International College) *', 'Beijing Normal University'],
      ['Shanghai Jiaotong University', 'Shanghai Jiao Tong University'],
      ['Huazhong Agricultural University / Central China Agricultural University', 'Huazhong Agricultural University'],
      ['Sun Yat-Sen University (might appear as Zhongshan University)', 'Sun Yat-Sen University'],
      ['Suzhou (Soochow) University**', 'Soochow University'],
      ["Xidian University (also known as Xi'an Electronic Science and Technology University)**", 'Xidian University'],
      ['Zhengzhou University**', 'Zhengzhou University'],
    ];

    expect(institutions).toHaveLength(118);
    for (const pair of variants) {
      const matches = pair.map((officialName) => institutions.find((institution) =>
        [institution.nameEn, ...institution.aliases].includes(officialName)));
      expect(matches[0]?.id).toBe(matches[1]?.id);
      expect(new Set(requirements
        .filter((fact) => fact.institutionId === matches[0]?.id)
        .map((fact) => fact.sourceId))).toEqual(new Set(['ucl-china', 'edinburgh-china']));
    }
  });

  it('preserves each source spelling after canonical institution matching', () => {
    const beihangId = institutions.find((institution) => institution.nameZh === '北京航空航天大学')?.id;
    const officialName = (sourceId: string) => requirements.find((fact) =>
      fact.sourceId === sourceId && fact.institutionId === beihangId)?.institutionOfficial;

    expect(officialName('ucl-china')).toBe('Beihang University (formerly Beijing University of Aeronautics & Astronautics)');
    expect(officialName('edinburgh-china')).toBe('Beihang University');
  });
});

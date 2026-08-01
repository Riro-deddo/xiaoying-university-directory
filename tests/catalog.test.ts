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
    expect(universities.every((item) => cohortIds.has(item.id))).toBe(true);
  });

  it('covers every frozen cohort university exactly once without pending records', () => {
    const cohortIds = [...cohort.universities.map((item) => item.id)].sort();
    const publicIds = [...universities.map((item) => item.id)].sort();

    expect(publicIds).toEqual(cohortIds);
    expect(universities.every((item) => item.state !== 'pending')).toBe(true);
  });

  it('references only explicitly registered official sources', () => {
    const sourceIds = new Set(sources.map((source) => source.id));
    expect(universities.flatMap((item) => item.sourceIds)
      .every((id) => sourceIds.has(id))).toBe(true);
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
});

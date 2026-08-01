import { describe, expect, it } from 'vitest';
import cohort from '../src/data/qs-2027-top-200-uk.json';
import universities from '../src/data/universities.json';
import sources from '../src/data/sources.json';

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

  it('references only explicitly registered official sources', () => {
    const sourceIds = new Set(sources.map((source) => source.id));
    expect(universities.flatMap((item) => item.sourceIds)
      .every((id) => sourceIds.has(id))).toBe(true);
  });
});

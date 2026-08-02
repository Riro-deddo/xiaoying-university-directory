import { describe, expect, it } from 'vitest';
import sources from '../src/data/sources.json';
import {
  joinUniversityStatuses,
  loadUniversities,
  validateOfficialSources,
  validateUniversities,
} from '../src/lib/data';
import type { OfficialSourceConfig, StatusMap, University } from '../src/lib/types';

const validUniversity: University = {
  id: 'imperial',
  nameZh: 'Imperial',
  nameEn: 'Imperial College London',
  aliases: ['IC', 'ICL'],
  directoryCategory: 'qs-top-200',
  qs: { edition: 2027, rank: 2 },
  state: 'official-list',
  officialDomain: 'https://www.imperial.ac.uk',
  sourceIds: ['imperial-china'],
};

const validSource: OfficialSourceConfig = {
  id: 'imperial-china',
  universityId: 'imperial',
  labelZh: 'China requirements',
  url: 'https://www.imperial.ac.uk/study/international-students/information-by-region/east-asia/',
  kind: 'china-requirements',
  scope: 'university',
  scopeZh: 'Official information for East Asia applicants',
  institutionRule: {
    type: 'none',
    summaryZh: 'The source contains requirements but no institution list.',
  },
  parser: {
    mode: 'link-only',
    guard: { minimumRecords: 0, maximumRecords: 1, maximumRemovalRatio: 0 },
  },
};

describe('validateUniversities', () => {
  it('accepts a complete QS 2027 university record', () => {
    expect(validateUniversities([validUniversity])).toEqual([validUniversity]);
  });

  it.each([
    ['unsupported state', { ...validUniversity, state: 'rejected' }],
    ['non-HTTPS official domain', { ...validUniversity, officialDomain: 'http://example.com' }],
    ['missing Chinese name', { ...validUniversity, nameZh: '' }],
  ])('rejects %s', (_label, record) => {
    expect(() => validateUniversities([record])).toThrow();
  });

  it('rejects duplicate stable IDs', () => {
    expect(() => validateUniversities([validUniversity, validUniversity])).toThrow(/duplicate/i);
  });
});

describe('validateOfficialSources', () => {
  it('accepts an explicitly configured official source', () => {
    expect(validateOfficialSources([validSource])).toEqual([validSource]);
  });

  it('requires human-reviewed institution rule metadata on every official source', () => {
    expect(validateOfficialSources(sources)).toHaveLength(sources.length);
    expect(sources.every((source) => source.institutionRule.summaryZh.trim().length > 0)).toBe(true);
  });

  it.each([
    ['unknown field', { ...validSource, untracked: true }],
    ['non-HTTPS URL', { ...validSource, url: 'http://example.com/list' }],
    ['invalid removal ratio', { ...validSource, parser: { ...validSource.parser, guard: { ...validSource.parser.guard, maximumRemovalRatio: 1.1 } } }],
    ['blank scope description', { ...validSource, scopeZh: '   ' }],
    ['faculty source without scope description', { ...validSource, scope: 'faculty', scopeZh: '' }],
    ['HTML list parser without an official default tier', {
      ...validSource,
      parser: {
        mode: 'html-list',
        selector: '#official-list',
        guard: validSource.parser.guard,
      },
    }],
    ['PDF parser without a registered row pattern', {
      ...validSource,
      parser: {
        mode: 'pdf-text',
        headingPattern: '^University \\| Tier$',
        institutionColumn: 0,
        guard: validSource.parser.guard,
      },
    }],
  ])('rejects %s', (_label, source) => {
    expect(() => validateOfficialSources([source])).toThrow();
  });

  it('rejects duplicate source IDs', () => {
    expect(() => validateOfficialSources([validSource, validSource])).toThrow(/duplicate/i);
  });
});

describe('joinUniversityStatuses', () => {
  it('joins registered source status without mutating human data', () => {
    const input = structuredClone(validUniversity);
    const status: StatusMap = {
      'imperial-china': {
        sourceId: validSource.id,
        health: 'ok',
        checkedAt: '2026-08-01T08:00:00.000Z',
        lastSuccessfulAt: '2026-08-01T08:00:00.000Z',
        httpStatus: 200,
        finalUrl: validSource.url,
      },
    };

    const [joined] = joinUniversityStatuses([validUniversity], [validSource], status);

    expect(joined.sources[0].status?.health).toBe('ok');
    expect(joined.sources[0].id).toBe(validSource.id);
    expect(validUniversity).toEqual(input);
  });
});

describe('QS 2027 starter ranks', () => {
  it('matches the published QS 2027 positions', () => {
    const ranks = Object.fromEntries(
      loadUniversities()
        .filter((university) => university.directoryCategory === 'qs-top-200')
        .map((university) => [university.id, university.qs!.rank]),
    );

    expect(ranks).toMatchObject({
      'imperial-college-london': 2,
      'university-college-london': 8,
      'university-of-edinburgh': 35,
    });
  });
});

describe('explicit directory scope', () => {
  it('includes 28 ranked universities and LBS as a specialist institution', () => {
    const universities = loadUniversities();

    expect(universities.filter((item) => item.directoryCategory === 'qs-top-200')).toHaveLength(28);
    expect(universities.find((item) => item.id === 'london-business-school')).toMatchObject({
      directoryCategory: 'specialist',
      state: 'not-public',
    });
    expect(universities.find((item) => item.id === 'london-business-school')).not.toHaveProperty('qs');
    expect(new Set(universities.map((item) => item.id)).size).toBe(29);
  });
});

import { describe, expect, it } from 'vitest';
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

  it.each([
    ['unknown field', { ...validSource, untracked: true }],
    ['non-HTTPS URL', { ...validSource, url: 'http://example.com/list' }],
    ['invalid removal ratio', { ...validSource, parser: { ...validSource.parser, guard: { ...validSource.parser.guard, maximumRemovalRatio: 1.1 } } }],
    ['faculty source without scope description', { ...validSource, scope: 'faculty', scopeZh: '' }],
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
      loadUniversities().map((university) => [university.id, university.qs.rank]),
    );

    expect(ranks).toMatchObject({
      'imperial-college-london': 2,
      'university-college-london': 8,
      'university-of-edinburgh': 35,
    });
  });
});

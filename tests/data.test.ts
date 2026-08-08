import { describe, expect, it } from 'vitest';
import rankings from '../src/data/rankings.json';
import sources from '../src/data/sources.json';
import universitiesJson from '../src/data/universities.json';
import {
  DataValidationError,
  joinUniversityStatuses,
  loadRankings,
  loadUniversities,
  validateOfficialSources,
  validateUniversities,
} from '../src/lib/data';
import type { OfficialSourceConfig, StatusMap, University } from '../src/lib/types';

const universities: University[] = validateUniversities(universitiesJson);

const validUniversity: University = {
  id: 'imperial',
  nameZh: 'Imperial',
  nameEn: 'Imperial College London',
  aliases: ['IC', 'ICL'],
  directoryCategory: 'qs-directory',
  qsDirectory: { firstEdition: 2027, verifiedEdition: 2027, current: true },
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

  it('accepts registered grouped and bilingual HTML parser fields', () => {
    expect(validateOfficialSources([{
      ...validSource,
      parser: {
        mode: 'html-grouped-items',
        groups: [{ selector: '#China .group-a', tierOfficial: 'Group A' }],
        itemSelector: 'li',
        institutionPattern: '^(?<institutionOfficial>.+)$',
        guard: validSource.parser.guard,
      },
    }, {
      ...validSource,
      id: 'imperial-bilingual-table',
      parser: {
        mode: 'html-table',
        tableIndex: 0,
        rowSelector: 'tbody tr',
        institutionColumn: 0,
        nameZhColumn: 1,
        scoreColumns: [{ label: '2:1', column: 2 }, { label: '2:2', column: 3 }],
        splitOnBreaks: true,
        institutionPattern: '^(?<institutionOfficial>.+)$',
        guard: validSource.parser.guard,
      },
    }])).toHaveLength(2);
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
        .filter((university) => university.directoryCategory === 'qs-directory')
        .map((university) => [university.id, university.rankings.qs!.sortRank]),
    );

    expect(ranks).toMatchObject({
      'imperial-college-london': 2,
      'university-college-london': 8,
      'university-of-edinburgh': 35,
    });
  });
});

describe('explicit directory scope', () => {
  it('includes 93 ranked universities and LBS as a specialist institution', () => {
    const universities = loadUniversities();

    expect(universities.filter((item) => item.directoryCategory === 'qs-directory')).toHaveLength(93);
    expect(universities.find((item) => item.id === 'london-business-school')).toMatchObject({
      directoryCategory: 'specialist',
      state: 'not-public',
    });
    expect(universities.find((item) => item.id === 'london-business-school')).not.toHaveProperty('rankings.qs');
    expect(new Set(universities.map((item) => item.id)).size).toBe(94);
  });
});

describe('current QS directory ranking coverage', () => {
  const currentQsDirectoryMembers = universities.filter((university) =>
    university.directoryCategory === 'qs-directory' && university.qsDirectory?.current,
  );

  it('gives every current QS-directory member exactly one ranked QS record at its verified edition', () => {
    const dataset = loadRankings(rankings, universities);

    expect(currentQsDirectoryMembers).toHaveLength(93);
    for (const university of currentQsDirectoryMembers) {
      const records = dataset.records.filter((record) =>
        record.universityId === university.id
        && record.provider === 'qs'
        && record.edition === university.qsDirectory!.verifiedEdition,
      );
      expect(records).toHaveLength(1);
      expect(records[0].placement).not.toMatch(/^(unranked|unverified)$/u);
    }
  });

  it.each(currentQsDirectoryMembers)('rejects a missing verified QS record for $nameEn', (university) => {
    const withoutMemberRecord = {
      ...rankings,
      records: rankings.records.filter((record) => record.universityId !== university.id),
    };

    expect(() => loadRankings(withoutMemberRecord, universities)).toThrow(DataValidationError);
  });

  it.each([
    ['is registered only at a different edition', {
      ...rankings,
      releases: [...rankings.releases, { ...rankings.releases[0], edition: 2026 }],
      records: rankings.records.map((record) => record.universityId === 'imperial-college-london'
        ? { ...record, edition: 2026 }
        : record),
    }],
    ['is unverified', {
      ...rankings,
      records: rankings.records.map((record) => record.universityId === 'imperial-college-london'
        ? {
          universityId: record.universityId,
          provider: record.provider,
          edition: record.edition,
          placement: 'unverified' as const,
        }
        : record),
    }],
  ])('rejects a current QS-directory member whose verified record %s', (_label, dataset) => {
    expect(() => loadRankings(dataset, universities)).toThrow(DataValidationError);
  });
});

import { describe, expect, it } from 'vitest';
import mastersCourseDirectories from '../src/data/masters-course-directories.json';
import mastersScholarshipEntries from '../src/data/masters-scholarship-entries.json';
import rankings from '../src/data/rankings.json';
import sources from '../src/data/sources.json';
import statusesJson from '../src/data/status.json';
import universitiesJson from '../src/data/universities.json';
import {
  DataValidationError,
  joinMastersCourseDirectories,
  joinMastersScholarshipEntries,
  joinUniversityStatuses,
  loadRankings,
  loadUniversities,
  validateOfficialSources,
  validateUniversities,
} from '../src/lib/data';
import type {
  MastersCourseDirectory,
  MastersScholarshipEntry,
  OfficialSourceConfig,
  StatusMap,
  University,
} from '../src/lib/types';

const universities: University[] = validateUniversities(universitiesJson);
const statuses = statusesJson as StatusMap;

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

describe('joinMastersCourseDirectories', () => {
  const directory: MastersCourseDirectory = {
    id: 'masters-imperial',
    universityId: validUniversity.id,
    labelZh: '查看全部硕士课程',
    url: 'https://www.imperial.ac.uk/study/courses/',
    pageTitle: 'Postgraduate courses',
    reviewedAt: '2026-08-11',
    requiredText: ['Postgraduate courses'],
    monitorMode: 'page-identity',
  };
  const chinaStatus = {
    sourceId: validSource.id,
    health: 'ok' as const,
    checkedAt: '2026-08-10T03:00:00.000Z',
  };
  const courseStatus = {
    sourceId: directory.id,
    health: 'changed' as const,
    checkedAt: '2026-08-11T03:00:00.000Z',
  };
  const statuses: StatusMap = {
    [validSource.id]: chinaStatus,
    [directory.id]: courseStatus,
  };

  it('joins exactly the current course-entry status without mutating either input', () => {
    const universityRecords = joinUniversityStatuses([validUniversity], [validSource], statuses);
    const originalUniversities = structuredClone(universityRecords);
    const originalDirectories = structuredClone([directory]);

    const [joined] = joinMastersCourseDirectories(universityRecords, [directory], statuses);

    expect(joined.mastersCourse).toEqual({ ...directory, status: courseStatus });
    expect(joined.sources[0].status).toEqual(chinaStatus);
    expect(universityRecords).toEqual(originalUniversities);
    expect([directory]).toEqual(originalDirectories);
  });

  it('rejects a missing university directory', () => {
    const universityRecords = joinUniversityStatuses([validUniversity], [validSource], statuses);

    expect(() => joinMastersCourseDirectories(universityRecords, [], statuses))
      .toThrow(/missing.*imperial/i);
  });

  it('rejects an extra university directory', () => {
    const universityRecords = joinUniversityStatuses([validUniversity], [validSource], statuses);

    expect(() => joinMastersCourseDirectories(universityRecords, [
      directory,
      { ...directory, id: 'masters-extra', universityId: 'extra' },
    ], statuses)).toThrow(/extra.*extra/i);
  });

  it('rejects duplicate directory university IDs even when stable IDs differ', () => {
    const universityRecords = joinUniversityStatuses([validUniversity], [validSource], statuses);

    expect(() => joinMastersCourseDirectories(universityRecords, [
      directory,
      { ...directory, id: 'masters-imperial-copy' },
    ], statuses)).toThrow(/duplicate.*imperial/i);
  });
});

describe('joinMastersScholarshipEntries', () => {
  const directory: MastersCourseDirectory = {
    id: 'masters-imperial',
    universityId: validUniversity.id,
    labelZh: '查看全部硕士课程',
    url: 'https://www.imperial.ac.uk/study/courses/',
    pageTitle: 'Postgraduate courses',
    reviewedAt: '2026-08-11',
    requiredText: ['Postgraduate courses'],
    monitorMode: 'page-identity',
  };
  const links = [{
    id: 'scholarships-imperial-directory',
    universityId: validUniversity.id,
    labelZh: '查看硕士奖学金官网' as const,
    scopeZh: '硕士奖学金官方目录',
    kind: 'masters-directory' as const,
    requiresFiltering: false,
    url: 'https://www.imperial.ac.uk/study/fees-and-funding/postgraduate/',
    pageTitle: 'Postgraduate fees and funding',
    reviewedAt: '2026-08-31',
    requiredText: ['Postgraduate', 'Scholarships'],
    monitorMode: 'page-identity' as const,
  }, {
    id: 'scholarships-imperial-search',
    universityId: validUniversity.id,
    labelZh: '查看硕士奖学金官网' as const,
    scopeZh: '硕士奖学金官方搜索器',
    kind: 'masters-search' as const,
    requiresFiltering: false,
    url: 'https://www.imperial.ac.uk/study/fees-and-funding/postgraduate/search/',
    pageTitle: 'Scholarships search',
    reviewedAt: '2026-08-31',
    requiredText: ['Scholarships', 'Search'],
    monitorMode: 'page-identity' as const,
  }];
  const availableEntry: MastersScholarshipEntry = {
    universityId: validUniversity.id,
    entryState: 'available',
    reviewedAt: '2026-08-31',
    links,
  };
  const scholarshipStatuses: StatusMap = {
    [links[0].id]: { sourceId: links[0].id, health: 'ok', checkedAt: '2026-08-31T03:00:00.000Z' },
    [links[1].id]: { sourceId: links[1].id, health: 'changed', checkedAt: '2026-08-31T03:01:00.000Z' },
  };

  function courseJoinedUniversities() {
    return joinMastersCourseDirectories(
      joinUniversityStatuses([validUniversity], [validSource], {}),
      [directory],
      {},
    );
  }

  it('joins each available scholarship link to only its own status without mutating inputs', () => {
    const universityRecords = courseJoinedUniversities();
    const originalUniversities = structuredClone(universityRecords);
    const originalEntries = structuredClone([availableEntry]);

    const [joined] = joinMastersScholarshipEntries(
      universityRecords,
      [availableEntry],
      scholarshipStatuses,
    );

    expect(joined.mastersScholarships).toEqual({
      universityId: validUniversity.id,
      entryState: availableEntry.entryState,
      reviewedAt: availableEntry.reviewedAt,
      links: links.map((link) => ({ ...link, status: scholarshipStatuses[link.id] })),
    });
    expect(universityRecords).toEqual(originalUniversities);
    expect([availableEntry]).toEqual(originalEntries);
  });

  it('preserves a no-public-entry state and date with zero links and no status lookup', () => {
    const noPublicEntry: MastersScholarshipEntry = {
      universityId: validUniversity.id,
      entryState: 'no-public-entry',
      reviewedAt: '2026-08-30',
      links: [],
    };
    const noLookupStatuses = new Proxy({} as StatusMap, {
      get() {
        throw new Error('no-public-entry must not look up a link status');
      },
    });

    const [joined] = joinMastersScholarshipEntries(
      courseJoinedUniversities(),
      [noPublicEntry],
      noLookupStatuses,
    );

    expect(joined.mastersScholarships).toEqual(noPublicEntry);
  });

  it.each([
    ['missing', [], /missing.*imperial/i],
    ['extra', [
      availableEntry,
      { ...availableEntry, universityId: 'extra', links: [] },
    ], /extra.*extra/i],
    ['duplicate', [
      availableEntry,
      { ...availableEntry, reviewedAt: '2026-08-30' },
    ], /duplicate.*imperial/i],
  ])('rejects a %s scholarship group mapping', (_case, entries, error) => {
    expect(() => joinMastersScholarshipEntries(
      courseJoinedUniversities(),
      entries as MastersScholarshipEntry[],
      scholarshipStatuses,
    )).toThrow(error);
  });

  it('does not borrow a group or unrelated-link status for an available link', () => {
    const isolatedStatuses: StatusMap = {
      [validUniversity.id]: { sourceId: validUniversity.id, health: 'unavailable' },
      'scholarships-other-directory': { sourceId: 'scholarships-other-directory', health: 'temporary-error' },
    };

    const [joined] = joinMastersScholarshipEntries(
      courseJoinedUniversities(),
      [availableEntry],
      isolatedStatuses,
    );

    expect(joined.mastersScholarships.links.every((link) => link.status === undefined)).toBe(true);
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
  it('loads all 101 universities with one matching course entry and unchanged China sources', () => {
    const loaded = loadUniversities();
    const directoriesByUniversity = new Map(
      mastersCourseDirectories.map((directory) => [directory.universityId, directory]),
    );

    expect(loaded).toHaveLength(101);
    expect(new Set(loaded.map((university) => university.id)))
      .toEqual(new Set(mastersCourseDirectories.map((directory) => directory.universityId)));
    expect(loaded.every((university) => university.mastersCourse.universityId === university.id)).toBe(true);
    expect(loaded.every((university) => university.mastersScholarships.universityId === university.id)).toBe(true);
    expect(new Set(loaded.map((university) => university.mastersScholarships.universityId)))
      .toEqual(new Set(mastersScholarshipEntries.map((entry) => entry.universityId)));
    expect(loaded.every((university) => university.sources.every((source) => !source.id.startsWith('masters-'))))
      .toBe(true);

    for (const universityId of [
      'imperial-college-london',
      'university-of-oxford',
      'university-of-manchester',
      'university-of-greenwich',
      'royal-college-of-art',
    ]) {
      const directory = directoriesByUniversity.get(universityId)!;
      expect(loaded.find((university) => university.id === universityId)?.mastersCourse)
        .toEqual({ ...directory, status: statuses[directory.id] });
    }
  });

  it('includes 93 ranked universities and exactly eight approved specialist institutions', () => {
    const universities = loadUniversities();
    const specialistIds = universities
      .filter((item) => item.directoryCategory === 'specialist')
      .map((item) => item.id)
      .sort();

    expect(universities.filter((item) => item.directoryCategory === 'qs-directory')).toHaveLength(93);
    expect(specialistIds).toEqual([
      'cranfield-university',
      'institute-of-cancer-research-london',
      'liverpool-school-of-tropical-medicine',
      'london-business-school',
      'london-school-of-hygiene-and-tropical-medicine',
      'royal-college-of-art',
      'royal-college-of-music',
      'royal-veterinary-college',
    ]);
    expect(universities.find((item) => item.id === 'london-business-school')).toMatchObject({
      directoryCategory: 'specialist',
      state: 'not-public',
    });
    expect(universities.every((item) => !('specialistRanking' in item))).toBe(true);
    expect(universities.find((item) => item.id === 'london-business-school')?.strengthEvidence)
      .toMatchObject({
        provider: 'qs',
        placement: 'exact',
        subjectZh: '商业与管理',
        edition: 2026,
        displayRank: '9',
        noteZh: '专门商学院，不参与综合大学排序',
    });
    expect(universities.find((item) => item.id === 'london-business-school')).not.toHaveProperty('rankings.qs');
    expect(universities.find((item) => item.id === 'london-school-of-hygiene-and-tropical-medicine'))
      .toMatchObject({
        nameZh: '伦敦卫生与热带医学院',
        directoryCategory: 'specialist',
        state: 'china-requirements',
        sourceIds: ['lshtm-china-entry'],
        strengthEvidence: { provider: 'shanghai', placement: 'exact', subjectZh: '公共卫生', edition: 2025, displayRank: '3' },
      });
    expect(universities.find((item) => item.id === 'cranfield-university'))
      .toMatchObject({
        nameZh: '克兰菲尔德大学',
        directoryCategory: 'specialist',
        state: 'china-requirements',
        sourceIds: ['cranfield-china-entry'],
        strengthEvidence: { provider: 'qs', placement: 'exact', subjectZh: '机械、航空与制造工程', edition: 2026, displayRank: '55' },
      });
    expect(universities.find((item) => item.id === 'university-of-the-arts-london'))
      .toMatchObject({
        directoryCategory: 'qs-directory',
        strengthEvidence: {
          provider: 'qs',
          placement: 'exact',
          subjectZh: '艺术与设计',
          displayRank: '2',
        },
      });
    expect(universities.find((item) => item.id === 'royal-college-of-art')).toMatchObject({
      nameZh: '皇家艺术学院', aliases: ['RCA'], state: 'not-public',
      strengthEvidence: { provider: 'qs', placement: 'exact', subjectZh: '艺术与设计', displayRank: '1' },
    });
    expect(universities.find((item) => item.id === 'royal-veterinary-college')).toMatchObject({
      nameZh: '皇家兽医学院', aliases: ['RVC'], state: 'not-public',
      strengthEvidence: { provider: 'qs', placement: 'exact', subjectZh: '兽医学', displayRank: '1' },
    });
    expect(universities.find((item) => item.id === 'royal-college-of-music')).toMatchObject({
      nameZh: '皇家音乐学院', aliases: ['RCM'], state: 'china-requirements',
      strengthEvidence: { provider: 'qs', placement: 'exact', subjectZh: '音乐与表演艺术', displayRank: '2' },
    });
    expect(universities.find((item) => item.id === 'institute-of-cancer-research-london')).toMatchObject({
      nameZh: '伦敦癌症研究院', aliases: ['ICR', 'Institute of Cancer Research'], state: 'not-public',
      strengthEvidence: { provider: 'ref', placement: 'derived-national-exact', subjectZh: '生物科学', displayRank: '1' },
    });
    expect(universities.find((item) => item.id === 'liverpool-school-of-tropical-medicine')).toMatchObject({
      nameZh: '利物浦热带医学院', aliases: ['LSTM'], state: 'not-public',
      strengthEvidence: { provider: 'shanghai', placement: 'band', subjectZh: '公共卫生', displayRank: '76–100' },
    });
    expect(new Set(universities.map((item) => item.id)).size).toBe(101);
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

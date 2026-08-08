import { describe, expect, it } from 'vitest';
import { compareDirectoryUniversities, createUniversitySearch } from '../src/lib/search';
import { createInstitutionEvidenceSearch, type ReverseIndexEntry } from '../src/lib/search';
import { loadInstitutions, loadUniversities } from '../src/lib/data';
import reverseIndex from '../src/data/generated/reverse-index.json';
import type { DirectoryCategory, RankingRecord, UniversityWithStatus } from '../src/lib/types';

const gradeThresholdRule = {
  type: 'grade-threshold' as const,
  summaryZh: '院校决定成绩门槛。',
  listedMeaningZh: '名单内使用较低门槛。',
  unlistedMeaningZh: '名单外认可院校使用较高门槛。',
  verification: {
    reviewedAt: '2026-08-02',
    url: 'https://example.test/rule-meaning',
    requiredText: ['listed threshold', 'unlisted threshold'],
  },
};

const records: UniversityWithStatus[] = [
  {
    id: 'imperial', nameZh: '帝国理工学院', nameEn: 'Imperial College London', aliases: ['ICL', '帝国理工'],
    directoryCategory: 'qs-directory', qsDirectory: { firstEdition: 2027, verifiedEdition: 2027, current: true }, state: 'official-list', officialDomain: 'https://www.imperial.ac.uk', sources: [], rankings: { qs: { universityId: 'imperial', provider: 'qs', edition: 2027, placement: 'exact', displayRank: '2', sortRank: 2 } },
  },
  {
    id: 'ucl', nameZh: '伦敦大学学院', nameEn: 'University College London', aliases: ['UCL'],
    directoryCategory: 'qs-directory', qsDirectory: { firstEdition: 2027, verifiedEdition: 2027, current: true }, state: 'china-requirements', officialDomain: 'https://www.ucl.ac.uk', sources: [], rankings: { qs: { universityId: 'ucl', provider: 'qs', edition: 2027, placement: 'exact', displayRank: '9', sortRank: 9 } },
  },
  {
    id: 'edinburgh', nameZh: '爱丁堡大学', nameEn: 'The University of Edinburgh', aliases: ['爱大', 'Edinburgh'],
    directoryCategory: 'qs-directory', qsDirectory: { firstEdition: 2027, verifiedEdition: 2027, current: true }, state: 'faculty-only', officialDomain: 'https://www.ed.ac.uk', sources: [], rankings: { qs: { universityId: 'edinburgh', provider: 'qs', edition: 2027, placement: 'exact', displayRank: '27', sortRank: 27 } },
  },
  {
    id: 'london-business-school', nameZh: 'London Business School', nameEn: 'London Business School', aliases: ['LBS'],
    directoryCategory: 'specialist', state: 'not-public', officialDomain: 'https://www.london.edu', sources: [], rankings: {},
  },
];

function rankedUniversity(
  id: string,
  nameEn: string,
  rankings: UniversityWithStatus['rankings'],
  directoryCategory: DirectoryCategory = 'qs-directory',
): UniversityWithStatus {
  return {
    id,
    nameZh: nameEn,
    nameEn,
    aliases: [],
    directoryCategory,
    ...(directoryCategory === 'qs-directory'
      ? { qsDirectory: { firstEdition: 2027, verifiedEdition: 2027, current: true } }
      : { specialistRanking: { provider: 'qs', rankingName: 'QS WUR Ranking By Subject', subjectZh: '商业与管理', edition: 2026, displayRank: '9', sourceUrl: 'https://example.test/lbs' } }),
    state: 'pending',
    officialDomain: `https://${id}.example.test`,
    sources: [],
    rankings,
  };
}

const ranking = (
  universityId: string,
  provider: RankingRecord['provider'],
  placement: RankingRecord['placement'],
  displayRank?: string,
  sortRank?: number,
): RankingRecord => ({ universityId, provider, edition: provider === 'qs' ? 2027 : 2026, placement, ...(displayRank ? { displayRank } : {}), ...(sortRank ? { sortRank } : {}) });

const multiRankRecords = [
  rankedUniversity('same-rank-b', 'Beta University', { qs: ranking('same-rank-b', 'qs', 'tied', '=42', 42), the: ranking('same-rank-b', 'the', 'band', '201–250', 201) }),
  rankedUniversity('unverified', 'Unverified University', { qs: ranking('unverified', 'qs', 'exact', '100', 100), the: ranking('unverified', 'the', 'unverified') }),
  rankedUniversity('same-rank-a', 'Alpha University', { qs: ranking('same-rank-a', 'qs', 'tied', '=42', 42), the: ranking('same-rank-a', 'the', 'band', '201–250', 201) }),
  rankedUniversity('unranked', 'Unranked University', { qs: ranking('unranked', 'qs', 'exact', '90', 90), the: ranking('unranked', 'the', 'unranked') }),
  rankedUniversity('exact', 'Exact University', { qs: ranking('exact', 'qs', 'exact', '50', 50), the: ranking('exact', 'the', 'exact', '88', 88) }),
  rankedUniversity('london-business-school', 'London Business School', {}, 'specialist'),
];

describe('createUniversitySearch', () => {
  const directory = createUniversitySearch(records);

  it.each([
    ['帝国理工学院', 'imperial'],
    ['university college london', 'ucl'],
    ['爱大', 'edinburgh'],
    ['  UCL  ', 'ucl'],
    ['Edinburg', 'edinburgh'],
  ])('finds %s as %s', (query, id) => {
    expect(directory.search(query, []).map((item) => item.id)).toContain(id);
  });

  it('returns ranked records before specialist institutions for an empty query', () => {
    expect(directory.search('', []).map((item) => item.id)).toEqual(['imperial', 'ucl', 'edinburgh', 'london-business-school']);
    expect(directory.search('', []).at(-1)?.id).toBe('london-business-school');
  });

  it('sorts ranked universities before specialist institutions', () => {
    expect(compareDirectoryUniversities(records[2], records[3])).toBeLessThan(0);
  });

  it('does not include a fuzzy neighbour when an alias matches exactly', () => {
    expect(directory.search('UCL', []).map((item) => item.id)).toEqual(['ucl']);
  });

  it('filters by one or more official-information states', () => {
    expect(directory.search('', ['official-list', 'faculty-only']).map((item) => item.id)).toEqual(['imperial', 'edinburgh']);
  });

  it('returns an empty array when nothing is relevant', () => {
    expect(directory.search('完全不存在的学校', [])).toEqual([]);
  });

  it('supports QS, THE, and English-name sorting while keeping specialists last', () => {
    const ranked = createUniversitySearch(multiRankRecords);

    expect(ranked.search('', [], 'qs').map((item) => item.id)).toEqual([
      'same-rank-a', 'same-rank-b', 'exact', 'unranked', 'unverified', 'london-business-school',
    ]);
    expect(ranked.search('', [], 'the').map((item) => item.id)).toEqual([
      'exact', 'same-rank-a', 'same-rank-b', 'unranked', 'unverified', 'london-business-school',
    ]);
    expect(ranked.search('', [], 'name').map((item) => item.id)).toEqual([
      'same-rank-a', 'same-rank-b', 'exact', 'unranked', 'unverified', 'london-business-school',
    ]);
  });

  it('uses English name and ID as stable tie-breaks for a shared ranking', () => {
    const tied = [
      rankedUniversity('same-name-b', 'Same University', { qs: ranking('same-name-b', 'qs', 'tied', '=42', 42) }),
      rankedUniversity('same-name-a', 'Same University', { qs: ranking('same-name-a', 'qs', 'tied', '=42', 42) }),
    ];

    expect(tied.sort((left, right) => compareDirectoryUniversities(left, right, 'qs')).map((item) => item.id))
      .toEqual(['same-name-a', 'same-name-b']);
  });

  it('preserves exact bilingual search and state filters in a non-default sort mode', () => {
    const ranked = createUniversitySearch(multiRankRecords);

    expect(ranked.search('Exact University', ['pending'], 'the').map((item) => item.id)).toEqual(['exact']);
  });
});

describe('createInstitutionEvidenceSearch', () => {
  const directory = createInstitutionEvidenceSearch({
    institutions: [
      { id: 'peking', nameZh: '北京大学', nameEn: 'Peking University', aliases: ['北大'] },
      { id: 'tsinghua', nameZh: '清华大学', nameEn: 'Tsinghua University', aliases: ['清华'] },
    ],
    universities: [
      { ...records[2], sources: [{ id: 'edinburgh-list', universityId: 'edinburgh', labelZh: '官方名单', url: 'https://example.test/edinburgh', kind: 'official-list', scope: 'university', scopeZh: '学校范围', institutionRule: { ...gradeThresholdRule, type: 'mixed' }, parser: { mode: 'html-list', selector: '.row', guard: { minimumRecords: 0, maximumRecords: 10, maximumRemovalRatio: 0 } }, status: { sourceId: 'edinburgh-list', health: 'ok', lastSuccessfulAt: '2026-08-01T00:00:00.000Z' } }] },
      { ...records[0], sources: [{ id: 'imperial-faculty', universityId: 'imperial', labelZh: '学院名单', url: 'https://example.test/imperial', kind: 'faculty-page', scope: 'faculty', scopeZh: '商学院', institutionRule: { ...gradeThresholdRule, type: 'eligibility' }, parser: { mode: 'html-list', selector: '.row', guard: { minimumRecords: 0, maximumRecords: 10, maximumRemovalRatio: 0 } }, status: { sourceId: 'imperial-faculty', health: 'ok', lastSuccessfulAt: '2026-08-02T00:00:00.000Z' } }] },
      { ...records[1], sources: [{ id: 'ucl-list', universityId: 'ucl', labelZh: '官方名单', url: 'https://example.test/ucl', kind: 'official-list', scope: 'university', scopeZh: '学校范围', institutionRule: gradeThresholdRule, parser: { mode: 'html-list', selector: '.row', guard: { minimumRecords: 0, maximumRecords: 10, maximumRemovalRatio: 0 } }, status: { sourceId: 'ucl-list', health: 'changed' } }] },
    ],
    reverseIndex: [
      { institutionId: 'peking', institutionOfficial: 'Peking University', universityId: 'edinburgh', evidenceState: 'official-match', tierOfficial: 'Priority list', scopeZh: '学校范围', sourceId: 'edinburgh-list', lastSuccessfulAt: '2026-08-01T00:00:00.000Z', cycle: '2026/27' },
      { institutionId: 'peking', institutionOfficial: 'Peking University', universityId: 'imperial', evidenceState: 'faculty-match', tierOfficial: 'MBA list', scoreOfficial: '85%', scopeZh: '商学院', sourceId: 'imperial-faculty', lastSuccessfulAt: '2026-08-02T00:00:00.000Z' },
    ],
  });

  it.each([
    ['北京大学', 'peking'],
    ['Peking University', 'peking'],
    ['北大', 'peking'],
  ])('selects exact Chinese, English, and alias matches for %s', (query, id) => {
    const result = directory.search(query);
    expect(result.kind).toBe('selected');
    if (result.kind === 'selected') expect(result.institution.id).toBe(id);
  });

  it('keeps fuzzy results as chooser suggestions until a canonical school is selected', () => {
    const result = directory.search('Peking Universty');
    expect(result.kind).toBe('suggestions');
    if (result.kind === 'suggestions') expect(result.suggestions.map((item) => item.id)).toEqual(['peking']);
    expect(directory.select('peking').kind).toBe('selected');
  });

  it('sorts every UK evidence card by QS rank and derives evidence state precedence', () => {
    const result = directory.select('peking');
    expect(result.kind).toBe('selected');
    if (result.kind !== 'selected') return;
    expect(result.cards.map((card) => [card.university.id, card.evidence.state])).toEqual([
      ['imperial', 'faculty-match'],
      ['ucl', 'source-changed'],
      ['edinburgh', 'official-match'],
    ]);
    expect(result.cards.find((card) => card.university.id === 'edinburgh')?.evidence.institutionRule?.type).toBe('mixed');
    expect(result.cards.find((card) => card.university.id === 'edinburgh')).toMatchObject({
      ruleSourceUrl: 'https://example.test/rule-meaning',
      ruleReviewedAt: '2026-08-02',
    });
  });

  it('returns no selection for empty and unknown searches', () => {
    expect(directory.search('').kind).toBe('empty');
    expect(directory.search('不存在的院校').kind).toBe('unknown');
  });
});

describe('production institution evidence search', () => {
  const directory = createInstitutionEvidenceSearch({
    institutions: loadInstitutions(),
    universities: loadUniversities(),
    reverseIndex: reverseIndex as ReverseIndexEntry[],
  });

  it.each([
    ['UIBE', '对外经济贸易大学'],
    ['SUSTech', '南方科技大学'],
  ])('returns one complete evidence set for %s', (query, nameZh) => {
    const result = directory.search(query);
    expect(result.kind).toBe('selected');
    if (result.kind !== 'selected') return;
    expect(result.institution.nameZh).toBe(nameZh);
    expect(result.cards).toHaveLength(loadUniversities().length);
    expect(result.cards.some((card) => card.evidence.state === 'official-match' || card.evidence.state === 'faculty-match')).toBe(true);
  });
});

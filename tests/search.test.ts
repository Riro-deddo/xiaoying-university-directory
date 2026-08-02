import { describe, expect, it } from 'vitest';
import { compareDirectoryUniversities, createUniversitySearch } from '../src/lib/search';
import { createInstitutionEvidenceSearch, type ReverseIndexEntry } from '../src/lib/search';
import { loadInstitutions, loadUniversities } from '../src/lib/data';
import reverseIndex from '../src/data/generated/reverse-index.json';
import type { UniversityWithStatus } from '../src/lib/types';

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
    directoryCategory: 'qs-top-200', qs: { edition: 2027, rank: 2 }, state: 'official-list', officialDomain: 'https://www.imperial.ac.uk', sources: [],
  },
  {
    id: 'ucl', nameZh: '伦敦大学学院', nameEn: 'University College London', aliases: ['UCL'],
    directoryCategory: 'qs-top-200', qs: { edition: 2027, rank: 9 }, state: 'china-requirements', officialDomain: 'https://www.ucl.ac.uk', sources: [],
  },
  {
    id: 'edinburgh', nameZh: '爱丁堡大学', nameEn: 'The University of Edinburgh', aliases: ['爱大', 'Edinburgh'],
    directoryCategory: 'qs-top-200', qs: { edition: 2027, rank: 27 }, state: 'faculty-only', officialDomain: 'https://www.ed.ac.uk', sources: [],
  },
  {
    id: 'london-business-school', nameZh: 'London Business School', nameEn: 'London Business School', aliases: ['LBS'],
    directoryCategory: 'specialist', state: 'not-public', officialDomain: 'https://www.london.edu', sources: [],
  },
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
    expect(result.cards).toHaveLength(29);
    expect(result.cards.some((card) => card.evidence.state === 'official-match' || card.evidence.state === 'faculty-match')).toBe(true);
  });
});

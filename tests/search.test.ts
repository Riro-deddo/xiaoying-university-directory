import { describe, expect, it } from 'vitest';
import { createUniversitySearch } from '../src/lib/search';
import type { UniversityWithStatus } from '../src/lib/types';

const records: UniversityWithStatus[] = [
  {
    id: 'imperial', nameZh: '帝国理工学院', nameEn: 'Imperial College London', aliases: ['ICL', '帝国理工'],
    qs: { edition: 2027, rank: 2 }, state: 'official-list', sources: [],
  },
  {
    id: 'ucl', nameZh: '伦敦大学学院', nameEn: 'University College London', aliases: ['UCL'],
    qs: { edition: 2027, rank: 9 }, state: 'china-requirements', sources: [],
  },
  {
    id: 'edinburgh', nameZh: '爱丁堡大学', nameEn: 'The University of Edinburgh', aliases: ['爱大', 'Edinburgh'],
    qs: { edition: 2027, rank: 27 }, state: 'faculty-only', sources: [],
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

  it('returns all records in QS rank order for an empty query', () => {
    expect(directory.search('', []).map((item) => item.id)).toEqual(['imperial', 'ucl', 'edinburgh']);
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

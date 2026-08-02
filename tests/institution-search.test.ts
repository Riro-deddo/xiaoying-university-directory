import { describe, expect, it } from 'vitest';
import { createInstitutionSearch, normalizeInstitutionName } from '../src/lib/institution-search';
import { loadInstitutions } from '../src/lib/data';
import type { InstitutionRecord } from '../src/lib/types';

const records: InstitutionRecord[] = [
  { id: 'peking-university', nameZh: '北京大学', nameEn: 'Peking University', aliases: ['北大', 'Beida'] },
  { id: 'tsinghua-university', nameZh: '清华大学', nameEn: 'Tsinghua University', aliases: ['清华'] },
];

describe('normalizeInstitutionName', () => {
  it.each([
    ['  北京大学  ', '北京大学'],
    ['Ｐｅｋｉｎｇ　Ｕｎｉｖｅｒｓｉｔｙ', 'peking university'],
    ['Peking-University!', 'peking university'],
  ])('normalizes %s without transliterating it', (input, expected) => {
    expect(normalizeInstitutionName(input)).toBe(expected);
  });
});

describe('createInstitutionSearch', () => {
  const search = createInstitutionSearch(records);

  it.each([
    ['北京大学', 'peking-university'],
    ['peking university', 'peking-university'],
    ['北大', 'peking-university'],
  ])('finds the exact canonical or alias match for %s', (query, id) => {
    expect(search.find(query).map((record) => record.id)).toEqual([id]);
  });

  it('returns all exact matches for a reviewed ambiguous English name without choosing one', () => {
    const ambiguous = createInstitutionSearch([
      ...records,
      { id: 'conflict', nameZh: '冲突大学', nameEn: 'Conflict University', aliases: ['Ｂｅｉｄａ'] },
    ]);
    expect(ambiguous.find('Beida').map((record) => record.id)).toEqual(['peking-university', 'conflict']);
    expect(ambiguous.find('北京大学').map((record) => record.id)).toEqual(['peking-university']);
  });

  it('keeps fuzzy suggestions separate from exact selection', () => {
    expect(search.find('Peking Universty')).toEqual([]);
    expect(search.suggest('Peking Universty').map((record) => record.id)).toEqual(['peking-university']);
  });

  it('keeps the two reviewed English-name collisions as explicit choices in the full registry', () => {
    const fullRegistry = createInstitutionSearch(loadInstitutions());
    for (const name of ['Taizhou University', 'Wuyi University']) {
      expect(fullRegistry.find(name)).toHaveLength(2);
    }
    expect(fullRegistry.find('台州学院')).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import { createInstitutionSearch, normalizeInstitutionName } from '../src/lib/institution-search';
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

  it('rejects an alias normalized to two different canonical schools', () => {
    expect(() => createInstitutionSearch([
      ...records,
      { id: 'conflict', nameZh: '冲突大学', nameEn: 'Conflict University', aliases: ['Ｂｅｉｄａ'] },
    ])).toThrow('ALIAS_CONFLICT');
  });

  it('keeps fuzzy suggestions separate from exact selection', () => {
    expect(search.find('Peking Universty')).toEqual([]);
    expect(search.suggest('Peking Universty').map((record) => record.id)).toEqual(['peking-university']);
  });
});

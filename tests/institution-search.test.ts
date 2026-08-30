import { describe, expect, it } from 'vitest';
import { createInstitutionSearch, exactSearchNameCollisions, normalizeInstitutionName } from '../src/lib/institution-search';
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

  it('uses only explicit aliases for standalone abbreviations', () => {
    const abbreviated = createInstitutionSearch([
      { id: 'uibe', nameZh: '对外经济贸易大学', nameEn: 'University of International Business and Economics (UIBE)', aliases: ['UIBE'] },
      { id: 'sustech', nameZh: '南方科技大学', nameEn: 'Southern University of Science and Technology (SUSTech)', aliases: ['SUSTech'] },
    ]);
    expect(abbreviated.find('UIBE').map((record) => record.id)).toEqual(['uibe']);
    expect(abbreviated.find('SUSTech').map((record) => record.id)).toEqual(['sustech']);

    const noDerivedAlias = createInstitutionSearch([
      { id: 'uibe', nameZh: '对外经济贸易大学', nameEn: 'University of International Business and Economics (UIBE)', aliases: [] },
    ]);
    expect(noDerivedAlias.find('UIBE')).toEqual([]);
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

  it('keeps only the reviewed normalized English collisions and singular canonical Chinese names', () => {
    const institutions = loadInstitutions();
    expect(exactSearchNameCollisions(institutions)).toEqual([
      ['chongqing institute of engineering', ['cn-c1c6db12d8c0bf1b', 'cn-f7207212a237fd55']],
      ['taizhou university', ['cn-79d6215ce67db635', 'cn-c2388dc8089d8ecb']],
      ['wuyi university', ['cn-0f4e2477ec1b1de6', 'cn-606aa744bd4add70']],
    ]);

    const canonicalChineseNames = institutions.map((record) => normalizeInstitutionName(record.nameZh));
    expect(new Set(canonicalChineseNames).size).toBe(canonicalChineseNames.length);
    const fullRegistry = createInstitutionSearch(institutions);
    expect(fullRegistry.find('台州学院')).toHaveLength(1);
    expect(fullRegistry.find('泰州学院')).toHaveLength(1);
  });
});

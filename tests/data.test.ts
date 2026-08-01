import { describe, expect, it } from 'vitest';
import { joinUniversityStatuses, validateUniversities } from '../src/lib/data';
import type { StatusMap, University } from '../src/lib/types';

const validUniversity: University = {
  id: 'imperial',
  nameZh: '帝国理工学院',
  nameEn: 'Imperial College London',
  aliases: ['IC', 'ICL'],
  qs: { edition: 2027, rank: 2 },
  state: 'official-list',
  sources: [
    {
      id: 'imperial-china',
      labelZh: '查看中国申请要求',
      url: 'https://www.imperial.ac.uk/study/international-students/information-by-region/east-asia/',
      kind: 'china-requirements',
      scopeZh: '学校官网面向东亚申请者的信息',
    },
  ],
};

describe('validateUniversities', () => {
  it('accepts a complete QS 2027 university record', () => {
    expect(validateUniversities([validUniversity])).toEqual([validUniversity]);
  });

  it.each([
    ['unsupported state', { ...validUniversity, state: 'rejected' }],
    ['non-HTTPS source', { ...validUniversity, sources: [{ ...validUniversity.sources[0], url: 'http://example.com/list' }] }],
    ['missing Chinese name', { ...validUniversity, nameZh: '' }],
  ])('rejects %s', (_label, record) => {
    expect(() => validateUniversities([record])).toThrow();
  });

  it('rejects duplicate stable IDs', () => {
    expect(() => validateUniversities([validUniversity, validUniversity])).toThrow(/重复/);
  });
});

describe('joinUniversityStatuses', () => {
  it('joins machine status by source ID without mutating human data', () => {
    const input = structuredClone(validUniversity);
    const status: StatusMap = {
      'imperial-china': {
        sourceId: 'imperial-china',
        health: 'ok',
        checkedAt: '2026-08-01T08:00:00.000Z',
        lastSuccessfulAt: '2026-08-01T08:00:00.000Z',
        httpStatus: 200,
        finalUrl: validUniversity.sources[0].url,
      },
    };

    const [joined] = joinUniversityStatuses([validUniversity], status);

    expect(joined.sources[0].status?.health).toBe('ok');
    expect(validUniversity).toEqual(input);
  });
});

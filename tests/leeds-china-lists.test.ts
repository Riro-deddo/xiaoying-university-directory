import requirements from '../src/data/generated/requirements.json';
import institutions from '../src/data/institutions.json';
import sources from '../src/data/sources.json';
import universities from '../src/data/universities.json';
import { describe, expect, it } from 'vitest';

const universityId = 'university-of-leeds';
const sourceIds = [
  'leeds-business-china',
  'leeds-computer-science-media-china',
  'leeds-other-schools-a-l-china',
  'leeds-other-schools-m-z-china',
] as const;

describe('University of Leeds accepted Chinese institutions', () => {
  it('publishes four separately scoped official lists for 2026/27 entry', () => {
    const university = universities.find((record) => record.id === universityId);
    const leedsSources = sources.filter((source) => source.universityId === universityId);

    expect(university).toMatchObject({
      state: 'official-list',
      sourceIds: [...sourceIds],
    });
    expect(leedsSources.map((source) => source.id)).toEqual([...sourceIds]);
    expect(leedsSources.every((source) => source.kind === 'official-list')).toBe(true);
    expect(leedsSources.every((source) => source.scope === 'faculty')).toBe(true);
    expect(leedsSources.every((source) => source.cycle === '2026/27')).toBe(true);
    expect(leedsSources.every((source) => source.institutionRule.type === 'eligibility')).toBe(true);
  });

  it('keeps each official list independently searchable', () => {
    const factsBySource = new Map(sourceIds.map((sourceId) => [
      sourceId,
      requirements.filter((fact) => fact.sourceId === sourceId),
    ]));

    expect(factsBySource.get('leeds-business-china')?.length).toBeGreaterThanOrEqual(850);
    expect(factsBySource.get('leeds-computer-science-media-china')?.length).toBeGreaterThanOrEqual(850);
    expect(factsBySource.get('leeds-other-schools-a-l-china')?.length).toBeGreaterThanOrEqual(600);
    expect(factsBySource.get('leeds-other-schools-m-z-china')?.length).toBeGreaterThanOrEqual(600);

    expect(factsBySource.get('leeds-business-china')
      ?.some((fact) => fact.institutionOfficial === 'Peking University')).toBe(true);
    expect(factsBySource.get('leeds-computer-science-media-china')
      ?.some((fact) => fact.institutionOfficial === 'Peking University')).toBe(true);
    expect(factsBySource.get('leeds-other-schools-a-l-china')
      ?.some((fact) => fact.institutionOfficial === 'Fudan University')).toBe(true);
    expect(factsBySource.get('leeds-other-schools-m-z-china')
      ?.some((fact) => fact.institutionOfficial === 'Peking University')).toBe(true);
    expect(factsBySource.get('leeds-computer-science-media-china')
      ?.some((fact) => fact.institutionOfficial === 'Renmin University of China')).toBe(true);
    expect(factsBySource.get('leeds-other-schools-m-z-china')
      ?.some((fact) => fact.institutionOfficial === 'Renmin University of China')).toBe(true);
    expect(factsBySource.get('leeds-business-china')?.every((fact) => fact.scope === 'faculty')).toBe(true);
  });

  it('reuses reviewed identities when a listed institution has been renamed', () => {
    const expectedCurrentChineseNames = new Map([
      ['cn-244a574d4cfb3332', '桂林医科大学'],
      ['cn-b80944fc30e71725', '吉林化工大学'],
      ['cn-b9b1939ac1e73bf8', '天水师范大学'],
      ['cn-247a999d490c5497', '西藏农牧大学'],
      ['cn-f56ddf5450199c82', '沧州交通学院'],
      ['cn-f1d8cbbeacc21400', '中国人民武装警察部队海警学院'],
      ['cn-3644dc8ae527ce12', '邢台医学院'],
      ['cn-668da361a380a009', '肇庆医学院'],
    ]);
    const obsoleteIds = [
      'cn-1ea73d206dd443f7',
      'cn-29d54f2779473379',
      'cn-897bce5aa8e13764',
      'cn-a400de4efa9f357c',
      'cn-6bf5aa2786abf146',
      'cn-08ff50ca88df7341',
      'cn-81236dc437d8cdf3',
      'cn-1d7ff4c3cffaa3a6',
      'cn-5109cee27cccd05a',
    ];

    expect(institutions.some((record) => obsoleteIds.includes(record.id))).toBe(false);
    expect(requirements.some((fact) => obsoleteIds.includes(fact.institutionId))).toBe(false);
    for (const [id, nameZh] of expectedCurrentChineseNames) {
      expect(institutions.find((record) => record.id === id)?.nameZh, id).toBe(nameZh);
    }
    expect(institutions.find((record) => record.id === 'cn-de295a5bab75df4c')).toMatchObject({
      nameZh: '中国人民解放军空军通信士官学校',
      nameEn: 'The PLA Air Force Communications Officers College',
    });
    expect(institutions.find((record) => record.id === 'cn-de295a5bab75df4c')?.aliases)
      .not.toContain('The PLA Rocket Force Command College');
  });
});

import requirements from '../src/data/generated/requirements.json';
import institutions from '../src/data/institutions.json';
import sources from '../src/data/sources.json';
import universities from '../src/data/universities.json';
import audit from '../src/data/china-rule-audit.json';
import { describe, expect, it } from 'vitest';

const universityId = 'university-of-nottingham';

describe('University of Nottingham 2027 Chinese institution list', () => {
  it('publishes one university-wide list after removing the separate Law School list', () => {
    const university = universities.find((record) => record.id === universityId);
    const nottinghamSources = sources.filter((source) => source.universityId === universityId);

    expect(university).toMatchObject({
      state: 'official-list',
      sourceIds: ['nottingham-china'],
    });
    expect(nottinghamSources).toHaveLength(1);
    expect(nottinghamSources[0]).toMatchObject({
      id: 'nottingham-china',
      labelZh: '2027 中国研究生院校分档',
      scope: 'university',
      scopeZh: '所有学院、学部与系的研究生申请',
      cycle: '2027',
      institutionRule: {
        type: 'grade-threshold',
        summaryZh: expect.stringMatching(/取消.*法学院.*单独.*名单/u),
      },
    });
    expect(audit.find((row) => row.universityId === universityId)).toMatchObject({
      reviewDate: '2026-08-31',
      finding: expect.stringMatching(/2027.*removed.*separate.*Law School.*all faculties/iu),
    });
  });

  it('publishes the complete reviewed Tier 1 and Tier 2 tables', () => {
    const facts = requirements.filter((fact) => fact.sourceId === 'nottingham-china');

    expect(facts).toHaveLength(425);
    expect(facts.filter((fact) => fact.tierOfficial === 'Tier 1 一类院校')).toHaveLength(174);
    expect(facts.filter((fact) => fact.tierOfficial === 'Tier 2 二类院校')).toHaveLength(251);
    expect(facts.every((fact) => fact.scope === 'university')).toBe(true);
    expect(facts.every((fact) => fact.cycle === '2027')).toBe(true);
  });

  it.each([
    '广东外语外贸大学',
    '华侨大学',
    '江西财经大学',
    '上海对外经贸大学',
    '浙江工商大学',
  ])('uses the current university-wide Tier 1 classification for %s', (nameZh) => {
    const institution = institutions.find((record) => record.nameZh === nameZh);
    expect(institution, `missing institution ${nameZh}`).toBeDefined();

    const fact = requirements.find((record) =>
      record.sourceId === 'nottingham-china' && record.institutionId === institution?.id);
    expect(fact?.tierOfficial).toBe('Tier 1 一类院校');
  });

  it.each([
    ['cn-e111c2d270007593', 'cn-a2c2f00fccfa7688', '四川理工学院'],
    ['cn-956aefa25a18a4db', 'cn-885e4dd1f6bcc2e4', "西安财经大学 ('西安财经学院')"],
    ['cn-8a2f6d614d7f64b5', 'cn-517889c51df22bec', '信阳师范学院'],
    ['cn-418546fdcdab5198', 'cn-52df5f87e0b05569', '郑州轻工业学院'],
  ])('merges renamed historical identity %s into %s', (obsoleteId, canonicalId, historicalNameZh) => {
    expect(institutions.some((record) => record.id === obsoleteId)).toBe(false);
    expect(requirements.some((fact) => fact.institutionId === obsoleteId)).toBe(false);
    expect(institutions.find((record) => record.id === canonicalId)?.aliases).toContain(historicalNameZh);
  });
});

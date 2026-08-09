import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPublicData } from '../scripts/build-public-data.mjs';

const source = {
  id: 'ucl-china',
  universityId: 'university-college-london',
  labelZh: '中国研究生入学要求',
  url: 'https://www.ucl.ac.uk/prospective-students/international/china',
  kind: 'official-list',
  scope: 'university',
  scopeZh: '全校',
  institutionRule: {
    type: 'grade-threshold',
    summaryZh: '本科院校影响最低成绩门槛。',
    listedMeaningZh: '名单内使用较低成绩门槛。',
    unlistedMeaningZh: '名单外认可院校使用较高门槛。',
    verification: { reviewedAt: '2026-08-02', url: 'https://example.edu/rules', requiredText: ['85%'] },
  },
  parser: { mode: 'html-list', guard: { minimumRecords: 1, maximumRecords: 100, maximumRemovalRatio: 0.2 } },
};

describe('public lazy-data build', () => {
  it('ships all 101 universities with eight specialists and nine universal strength references', async () => {
    const records = JSON.parse(await readFile(join(process.cwd(), 'public', 'generated', 'universities.json'), 'utf8'));

    expect(records).toHaveLength(101);
    expect(new Set(records.map((record) => record.id))).toHaveLength(101);
    expect(records.every((record) => !('specialistRanking' in record))).toBe(true);
    const specialists = records.filter((record) => record.directoryCategory === 'specialist');
    expect(specialists).toHaveLength(8);
    expect(specialists.every((record) => Object.keys(record.rankings).length === 0)).toBe(true);
    expect(records.filter((record) => record.strengthEvidence)).toHaveLength(9);
    expect(records.find((record) => record.id === 'london-school-of-hygiene-and-tropical-medicine')).toMatchObject({
      strengthEvidence: { provider: 'shanghai', placement: 'exact', displayRank: '3' },
      rankings: {},
    });
    expect(records.find((record) => record.id === 'cranfield-university')).toMatchObject({
      strengthEvidence: { provider: 'qs', placement: 'exact', displayRank: '55' },
      rankings: {},
    });
    expect(records.find((record) => record.id === 'university-of-the-arts-london')).toMatchObject({
      strengthEvidence: { provider: 'qs', subjectZh: '艺术与设计', displayRank: '2' },
      rankings: { qs: {}, the: {} },
    });
    expect(records.find((record) => record.id === 'institute-of-cancer-research-london')).toMatchObject({
      strengthEvidence: { provider: 'ref', placement: 'derived-national-exact', displayRank: '1' },
      rankings: {},
    });
    expect(records.find((record) => record.id === 'liverpool-school-of-tropical-medicine')).toMatchObject({
      strengthEvidence: { provider: 'shanghai', placement: 'band', displayRank: '76–100' },
      rankings: {},
    });
  });

  it('writes joined university records with current ranks and no standalone ranking dataset', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'xiaoying-public-universities-'));
    const universities = [
      {
        id: 'university-of-oxford', nameZh: '牛津大学', nameEn: 'University of Oxford', aliases: ['Oxford'],
        directoryCategory: 'qs-directory', qsDirectory: { firstEdition: 2027, verifiedEdition: 2027, current: true },
        state: 'pending', officialDomain: 'https://www.ox.ac.uk', sourceIds: [],
      },
      {
        id: 'london-business-school', nameZh: '伦敦商学院', nameEn: 'London Business School', aliases: ['LBS'],
        directoryCategory: 'specialist', state: 'not-public', officialDomain: 'https://www.london.edu', sourceIds: [],
        strengthEvidence: {
          kind: 'subject-ranking', provider: 'qs', rankingName: 'QS WUR Ranking By Subject',
          subjectZh: '商业与管理', edition: 2026, placement: 'exact', displayRank: '9',
          sourceUrl: 'https://www.topuniversities.com/universities/london-business-school',
          noteZh: '专门商学院，不参与综合大学排序',
        },
      },
    ];
    const rankings = {
      releases: [],
      records: [
        { universityId: 'university-of-oxford', provider: 'qs', edition: 2027, placement: 'exact', displayRank: '4', sortRank: 4 },
        { universityId: 'university-of-oxford', provider: 'the', edition: 2026, placement: 'exact', displayRank: '1', sortRank: 1 },
      ],
    };

    await buildPublicData({ outputDir, universities, rankings, institutions: [], requirements: [], sources: [], statuses: {} });

    const records = JSON.parse(await readFile(join(outputDir, 'universities.json'), 'utf8'));
    expect(records.find((record) => record.id === 'university-of-oxford')).toMatchObject({
      rankings: { qs: { edition: 2027, displayRank: '4' }, the: { edition: 2026, displayRank: '1' } },
    });
    expect(records.find((record) => record.id === 'london-business-school')).toMatchObject({
      strengthEvidence: { subjectZh: '商业与管理', displayRank: '9' },
      rankings: {},
    });
    expect(await readdir(outputDir)).not.toContain('rankings.json');
  });

  it('writes one structured list file per parser-enabled source and a separate reverse index', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'xiaoying-public-data-'));
    const result = await buildPublicData({
      outputDir,
      institutions: [{ id: 'peking', nameZh: '北京大学', nameEn: 'Peking University', aliases: [] }],
      requirements: [{
        id: 'fact', universityId: 'university-college-london', sourceId: 'ucl-china', institutionId: 'peking',
        institutionOfficial: 'Peking University', tierOfficial: 'Band A', scope: 'university', scopeZh: '全校',
        extractedAt: '2026-08-02T00:00:00.000Z', contentHash: 'a'.repeat(64),
      }],
      sources: [source],
      statuses: { 'ucl-china': { sourceId: 'ucl-china', health: 'ok', lastSuccessfulAt: '2026-08-02T00:00:00.000Z' } },
    });

    expect(result).toEqual({ listFiles: 1, institutionRecords: 1, reverseIndexEntries: 1 });
    expect(await readdir(join(outputDir, 'lists'))).toEqual(['ucl-china.json']);
    expect(JSON.parse(await readFile(join(outputDir, 'lists', 'ucl-china.json'), 'utf8'))).toMatchObject({
      sourceId: 'ucl-china', rows: [{ nameZh: '北京大学' }],
    });
    expect(JSON.parse(await readFile(join(outputDir, 'reverse-index.json'), 'utf8'))).toHaveLength(1);
    expect(JSON.parse(await readFile(join(outputDir, 'institutions.json'), 'utf8'))).toMatchObject([
      { id: 'peking', nameZh: '北京大学' },
    ]);
  });

  it('writes all nine reviewed university-level lists from the trusted source snapshot', async () => {
    const root = process.cwd();
    const outputDir = await mkdtemp(join(tmpdir(), 'xiaoying-public-full-'));
    const readJson = async (...parts) => JSON.parse(await readFile(join(root, ...parts), 'utf8'));
    const result = await buildPublicData({
      outputDir,
      institutions: await readJson('src', 'data', 'institutions.json'),
      requirements: await readJson('src', 'data', 'generated', 'requirements.json'),
      sources: await readJson('src', 'data', 'sources.json'),
      statuses: await readJson('src', 'data', 'status.json'),
    });
    expect(result.listFiles).toBe(9);
    expect((await readdir(join(outputDir, 'lists'))).sort()).toEqual([
      'bristol-china.json', 'cambridge-china.json', 'edinburgh-china.json', 'glasgow-china.json',
      'nottingham-china.json', 'sheffield-china.json', 'southampton-china.json', 'ucl-china.json', 'warwick-china.json',
    ]);
    expect(result.reverseIndexEntries).toBeGreaterThan(4_000);
    expect(result.institutionRecords).toBeGreaterThan(2_900);
    expect(JSON.parse(await readFile(join(outputDir, 'institutions.json'), 'utf8'))).toHaveLength(result.institutionRecords);
  });

  it('preserves fact-level official Chinese row names for renamed institutions', async () => {
    const root = process.cwd();
    const outputDir = await mkdtemp(join(tmpdir(), 'xiaoying-public-row-names-'));
    const readJson = async (...parts) => JSON.parse(await readFile(join(root, ...parts), 'utf8'));
    const [institutions, requirements, sources, statuses] = await Promise.all([
      readJson('src', 'data', 'institutions.json'),
      readJson('src', 'data', 'generated', 'requirements.json'),
      readJson('src', 'data', 'sources.json'),
      readJson('src', 'data', 'status.json'),
    ]);
    await buildPublicData({ outputDir, institutions, requirements, sources, statuses });

    const rowsFor = async (sourceId) => (JSON.parse(await readFile(join(outputDir, 'lists', `${sourceId}.json`), 'utf8'))).rows;
    const southamptonRows = await rowsFor('southampton-china');
    const southamptonOldNames = ['阜阳师范学院', '广东技术师范学院', '嘉兴学院', '宁夏师范学院', '伊犁师范学院'];
    expect(southamptonRows.map((row) => row.nameZh)).toEqual(expect.arrayContaining(southamptonOldNames));

    const byId = new Map(institutions.map((institution) => [institution.id, institution]));
    const expectedSheffieldNames = requirements
      .filter((fact) => fact.sourceId === 'sheffield-china' && fact.institutionNameZh && fact.institutionNameZh !== byId.get(fact.institutionId)?.nameZh)
      .map((fact) => fact.institutionNameZh);
    expect((await rowsFor('sheffield-china')).map((row) => row.nameZh)).toEqual(expect.arrayContaining(expectedSheffieldNames));
  });
});

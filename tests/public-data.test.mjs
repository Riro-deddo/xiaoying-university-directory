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

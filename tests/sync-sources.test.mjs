import { access, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decideSourceUpdate, reconcileInstitution, repairGlasgowBilingualPdfNames, syncRegisteredSources } from '../scripts/sync-sources.mjs';
import reviewedRegistry from '../src/data/institutions.json';
import reviewedRequirements from '../src/data/generated/requirements.json';

const guard = {
  minimumRecords: 80,
  maximumRecords: 150,
  maximumRemovalRatio: 0.1,
  universityId: 'example-university',
  sourceId: 'example-source',
};

const source = {
  id: 'example-source',
  universityId: 'example-university',
  url: 'https://www.example.ac.uk/china-list',
  scope: 'university',
  scopeZh: 'University-wide list',
  institutionRule: { type: 'none', summaryZh: 'General requirements only.' },
  parser: { mode: 'html-table', guard },
};

const registeredInstitution = {
  id: 'example-institution',
  nameZh: 'Example Institution',
  nameEn: 'Example University',
  aliases: [],
};

function facts(count, overrides = {}) {
  return Array.from({ length: count }, (_, index) => ({
    id: `example-fact-${index + 1}`,
    universityId: 'example-university',
    sourceId: 'example-source',
    institutionId: `institution-${index + 1}`,
    institutionOfficial: `Example Institution ${index + 1}`,
    tierOfficial: 'Band A',
    scope: 'university',
    scopeZh: 'University-wide list',
    extractedAt: '2026-08-01T10:00:00.000Z',
    contentHash: 'fixture-hash',
    ...overrides,
  }));
}

function recordsForFacts(requirements) {
  return [...new Set(requirements.map((fact) => fact.institutionId))].map((id) => ({
    id,
    nameZh: `Chinese ${id}`,
    nameEn: `English ${id}`,
    aliases: [],
  }));
}

function extractedFactsWithRegisteredInstitutions(count) {
  return async (_source, _response, { institutions }) => {
    const extracted = facts(count);
    for (const record of recordsForFacts(extracted)) {
      if (!institutions.some((institution) => institution.id === record.id)) institutions.push(record);
    }
    return extracted;
  };
}

const temporaryDirectories = [];

async function createFiles(requirements = facts(100), status = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'xiaoying-source-sync-'));
  temporaryDirectories.push(directory);
  const paths = {
    institutionsPath: join(directory, 'institutions.json'),
    requirementsPath: join(directory, 'requirements.json'),
    statusPath: join(directory, 'status.json'),
    anomaliesPath: join(directory, 'source-anomalies.json'),
  };
  await Promise.all([
    writeFile(paths.institutionsPath, `${JSON.stringify(recordsForFacts(requirements))}\n`),
    writeFile(paths.requirementsPath, `${JSON.stringify(requirements)}\n`),
    writeFile(paths.statusPath, `${JSON.stringify(status)}\n`),
    writeFile(paths.anomaliesPath, '[]\n'),
  ]);
  return paths;
}

function acceptedResponse() {
  return new Response('<table></table>', { status: 200, headers: { 'content-type': 'text/html' } });
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('decideSourceUpdate', () => {
  it('accepts a structurally valid small change', () => {
    expect(decideSourceUpdate(facts(100), facts(102), guard))
      .toEqual({ accepted: true, reason: 'valid-change' });
  });

  it('rejects each unsafe candidate with a stable reason code', () => {
    expect(decideSourceUpdate(facts(100), [], guard)).toEqual({ accepted: false, reason: 'empty-output' });
    expect(decideSourceUpdate(facts(100), facts(79), { ...guard, maximumRemovalRatio: 0.5 }))
      .toEqual({ accepted: false, reason: 'below-minimum-records' });
    expect(decideSourceUpdate([], facts(151), guard)).toEqual({ accepted: false, reason: 'above-maximum-records' });
    expect(decideSourceUpdate([], facts(2, { id: 'duplicate-fact' }), guard))
      .toEqual({ accepted: false, reason: 'duplicate-fact-ids' });
    expect(decideSourceUpdate([], facts(1, { universityId: 'other-university' }), guard))
      .toEqual({ accepted: false, reason: 'university-mismatch' });
    expect(decideSourceUpdate([], facts(1, { sourceId: 'other-source' }), guard))
      .toEqual({ accepted: false, reason: 'source-mismatch' });
  });

  it('rejects mass removal before the configured lower bound', () => {
    expect(decideSourceUpdate(facts(100), facts(20), guard))
      .toEqual({ accepted: false, reason: 'removal-ratio-exceeded' });
  });

  it('rejects same-sized replacement and excessive identity churn', () => {
    const fullReplacement = facts(100).map((fact, index) => ({
      ...fact,
      id: `replacement-fact-${index + 1}`,
      institutionId: `replacement-institution-${index + 1}`,
    }));
    const partialReplacement = [
      ...facts(88),
      ...facts(12).map((fact, index) => ({
        ...fact,
        id: `replacement-fact-${index + 1}`,
        institutionId: `replacement-institution-${index + 1}`,
      })),
    ];

    expect(decideSourceUpdate(facts(100), fullReplacement, guard))
      .toEqual({ accepted: false, reason: 'removal-ratio-exceeded' });
    expect(decideSourceUpdate(facts(100), partialReplacement, guard))
      .toEqual({ accepted: false, reason: 'removal-ratio-exceeded' });
  });
});

describe('syncRegisteredSources', () => {
  it('reconciles every reviewed search identity before source refresh and remains idempotent', async () => {
    const paths = await createFiles([]);
    const obsoleteIds = [
      'cn-0f8a1bf9dbc39920', 'cn-ac97c4410bc4bf72', 'cn-c3666f26ac904b46', 'cn-9c79fa3641a2c89f',
      'cn-6df0ef9150bd1ff2', 'cn-555a8af33ef74196', 'cn-675dc89119eb7546', 'cn-7d594ee83f0ce08b',
      'cn-8662abe7b31277c2', 'cn-294892d926a099b1', 'cn-eb05e0e2c3858178', 'cn-228da9869d132d1c',
      'cn-4608925f6f37c011', 'cn-f31b82d745f6036c', 'cn-5014762bda41f881', 'cn-e198010d37f04649',
    ];
    const expectedCanonicalFactCounts = new Map([
      ['cn-38fe392afb9e622f', 3],
      ['university-of-international-business-and-economics-2a13872d', 8],
      ['cn-fd334bd375069320', 7],
      ['cn-2a43c086fb3735e8', 2],
      ['cn-5e462a0463a6da6f', 3],
      ['cn-3016ad038539ee1a', 2],
      ['cn-798a43f1d58b93f6', 4],
      ['cn-d65eedfa9c42cf79', 4],
      ['cn-d2d1c47bd0bdaac2', 3],
      ['cn-3eed51e9f008d2ea', 4],
      ['cn-13a3c963f474ff79', 4],
      ['cn-9e338bea93785dc4', 4],
      ['cn-420d922c78eeff4e', 4],
      ['cn-e1081944b32c4a84', 3],
      ['cn-c54a8bf9427f90d1', 3],
      ['cn-8e869295f3c945de', 4],
    ]);
    const expectedCanonicalNames = new Map([
      ['cn-fd334bd375069320', 'Southern University of Science and Technology'],
      ['cn-6e6aaf892c17a701', 'Nanchang Institute of Engineering'],
      ['cn-b8f2ae9f9e50d8de', 'Nanchang Institute of Technology'],
      ['cn-5cd7c382c835dda0', 'Beijing Normal University Zhuhai Branch Campus'],
      ['cn-d5e12e3100f1bfb3', 'Beijing Normal University, Zhuhai Campus'],
      ['cn-a384f90b16d88cfa', 'China University of Geosciences (Wuhan)'],
      ['cn-d65eedfa9c42cf79', 'College of Applied Science, Jiangxi University of Science and Technology'],
      ['cn-c820c6a1cc7042ee', 'Gannan University of Science and Technology'],
    ]);
    const expectedSourceIds = new Map([
      ['cn-38fe392afb9e622f', ['glasgow-china', 'sheffield-china', 'southampton-china']],
      ['university-of-international-business-and-economics-2a13872d', ['bristol-china', 'cambridge-china', 'glasgow-china', 'nottingham-china', 'sheffield-china', 'southampton-china', 'ucl-china', 'warwick-china']],
      ['cn-fd334bd375069320', ['bristol-china', 'cambridge-china', 'glasgow-china', 'nottingham-china', 'sheffield-china', 'southampton-china', 'warwick-china']],
      ['cn-2a43c086fb3735e8', ['glasgow-china', 'sheffield-china']],
      ['cn-5e462a0463a6da6f', ['glasgow-china', 'sheffield-china', 'southampton-china']],
      ['cn-3016ad038539ee1a', ['sheffield-china', 'southampton-china']],
      ['cn-798a43f1d58b93f6', ['glasgow-china', 'sheffield-china', 'southampton-china']],
      ['cn-d65eedfa9c42cf79', ['glasgow-china', 'sheffield-china', 'southampton-china']],
      ['cn-d2d1c47bd0bdaac2', ['glasgow-china', 'sheffield-china', 'southampton-china']],
      ['cn-3eed51e9f008d2ea', ['glasgow-china', 'sheffield-china', 'southampton-china']],
      ['cn-13a3c963f474ff79', ['glasgow-china', 'sheffield-china', 'southampton-china']],
      ['cn-9e338bea93785dc4', ['glasgow-china', 'sheffield-china', 'southampton-china']],
      ['cn-420d922c78eeff4e', ['glasgow-china', 'sheffield-china', 'southampton-china']],
      ['cn-e1081944b32c4a84', ['sheffield-china', 'southampton-china']],
      ['cn-c54a8bf9427f90d1', ['sheffield-china', 'southampton-china']],
      ['cn-8e869295f3c945de', ['glasgow-china', 'sheffield-china', 'southampton-china']],
    ]);

    const first = await syncRegisteredSources({
      ...paths,
      sources: [],
      institutions: structuredClone(reviewedRegistry),
      requirements: structuredClone(reviewedRequirements),
      status: {},
    });

    expect(first.institutions).toHaveLength(2915);
    expect(first.institutions.some((record) => obsoleteIds.includes(record.id))).toBe(false);
    expect(first.requirements.some((fact) => obsoleteIds.includes(fact.institutionId))).toBe(false);
    for (const [id, expectedCount] of expectedCanonicalFactCounts) {
      expect(first.requirements.filter((fact) => fact.institutionId === id)).toHaveLength(expectedCount);
    }
    for (const [id, sourceIds] of expectedSourceIds) {
      expect([...new Set(first.requirements.filter((fact) => fact.institutionId === id).map((fact) => fact.sourceId))].sort()).toEqual(sourceIds);
    }
    for (const [id, expectedName] of expectedCanonicalNames) {
      expect(first.institutions.find((record) => record.id === id)?.nameEn).toBe(expectedName);
    }
    expect(first.requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: 'glasgow-china', institutionId: 'cn-d65eedfa9c42cf79', institutionOfficial: 'Gannan University of Science and Technology', tierOfficial: 'E' }),
      expect.objectContaining({ sourceId: 'southampton-china', institutionId: 'cn-d65eedfa9c42cf79', institutionOfficial: 'College of Applied Science, Jiangxi University of Science and Technology', tierOfficial: 'Tier C' }),
      expect.objectContaining({ sourceId: 'southampton-china', institutionId: 'cn-c820c6a1cc7042ee', institutionOfficial: 'Gannan University of Science and Technology', tierOfficial: 'Tier B' }),
    ]));
    const registryNames = first.institutions.flatMap((record) => [record.nameZh, record.nameEn, ...record.aliases]);
    for (const malformedName of [
      ')北方民族大学', ')对外经济贸易大学', ')南方科技大学', ')香港科技大学(广州)', ')浙大宁波理工学院', '浙江树人学院浙江树人大学',
    ]) expect(registryNames).not.toContain(malformedName);

    const second = await syncRegisteredSources({
      ...paths,
      sources: [],
      institutions: structuredClone(first.institutions),
      requirements: structuredClone(first.requirements),
      status: {},
    });
    expect(second.institutions).toEqual(first.institutions);
    expect(second.requirements).toEqual(first.requirements);
  });

  it('does not recreate reviewed duplicate identities on a repeated bilingual source refresh', async () => {
    const paths = await createFiles([]);
    const migrationSource = {
      ...source,
      id: 'glasgow-china',
      parser: {
        mode: 'html-table',
        rowSelector: 'tbody tr',
        institutionColumn: 0,
        nameZhColumn: 1,
        tierColumn: 2,
        guard: { minimumRecords: 4, maximumRecords: 4, maximumRemovalRatio: 0 },
      },
    };
    const institutions = reviewedRegistry.filter((record) => [
      'cn-d2d1c47bd0bdaac2', 'cn-8662abe7b31277c2', 'cn-38fe392afb9e622f', 'cn-0f8a1bf9dbc39920',
      'cn-2a43c086fb3735e8', 'cn-9c79fa3641a2c89f',
    ].includes(record.id));
    const response = () => new Response(`
      <table><tbody>
        <tr><td>Foshan University</td><td>佛山大学</td><td>B</td></tr>
        <tr><td>Foshan University</td><td>佛山科学技术学院</td><td>B</td></tr>
        <tr><td>Beifang Minzu University (Northern Minzu University</td><td>)北方民族大学</td><td>C</td></tr>
        <tr><td>Hong Kong University of Science and Technology (Guangzhou</td><td>)香港科技大学 (广州)</td><td>TNE</td></tr>
      </tbody></table>
    `, { status: 200, headers: { 'content-type': 'text/html' } });

    const first = await syncRegisteredSources({
      ...paths,
      sources: [migrationSource],
      institutions: structuredClone(institutions),
      requirements: [],
      status: {},
      fetchImpl: vi.fn().mockImplementation(response),
      minimumGapMs: 0,
      now: new Date('2026-08-02T10:00:00Z'),
    });
    const second = await syncRegisteredSources({
      ...paths,
      sources: [migrationSource],
      institutions: structuredClone(first.institutions),
      requirements: structuredClone(first.requirements),
      status: first.status,
      fetchImpl: vi.fn().mockImplementation(response),
      minimumGapMs: 0,
      now: new Date('2026-08-02T10:00:00Z'),
    });

    expect(second.anomalies).toEqual([]);
    expect(second.institutions.map((record) => record.id).sort()).toEqual(['cn-2a43c086fb3735e8', 'cn-38fe392afb9e622f', 'cn-d2d1c47bd0bdaac2']);
    expect(second.requirements.map((fact) => fact.institutionId).sort()).toEqual(['cn-2a43c086fb3735e8', 'cn-38fe392afb9e622f', 'cn-d2d1c47bd0bdaac2', 'cn-d2d1c47bd0bdaac2']);
    expect(second.requirements.filter((fact) => fact.institutionId === 'cn-d2d1c47bd0bdaac2').map((fact) => fact.institutionNameZh).sort())
      .toEqual(['佛山大学', '佛山科学技术学院']);
    expect(second.requirements).toEqual(first.requirements);
  });

  it('reconciles existing Chinese, English, and alias names before creating a deterministic bilingual record', () => {
    const existing = {
      id: 'existing-institution',
      nameZh: 'åŒ—äº¬å¤§å­¦',
      nameEn: 'Peking University',
      aliases: ['Beida'],
    };
    const institutions = [existing];

    expect(reconcileInstitution({ institutionOfficial: 'Peking University', institutionNameZh: 'åŒ—äº¬å¤§å­¦' }, institutions))
      .toBe(existing);
    expect(reconcileInstitution({ institutionOfficial: 'Beida' }, institutions)).toBe(existing);
    existing.aliases.push('åŒ—å¤§');
    expect(reconcileInstitution({ institutionOfficial: 'Peking University (alias)', institutionNameZh: 'åŒ—å¤§' }, institutions))
      .toBe(existing);
    expect(reconcileInstitution({ institutionOfficial: 'New University', institutionNameZh: 'æ–°å¤§å­¦' }, institutions))
      .toMatchObject({
        id: expect.stringMatching(/^cn-[a-f0-9]{16}$/u),
        nameEn: 'New University',
        nameZh: 'æ–°å¤§å­¦',
        aliases: [],
      });
    expect(() => reconcileInstitution({ institutionOfficial: 'Unknown English Only' }, institutions))
      .toThrow(/No registered institution/u);
  });

  it('keeps distinct Chinese institutions apart when their official English names collide', () => {
    const institutions = [];
    const first = reconcileInstitution({ institutionOfficial: 'Taizhou University', institutionNameZh: 'Taizhou A' }, institutions);
    institutions.push(first);
    const second = reconcileInstitution({ institutionOfficial: 'Taizhou University', institutionNameZh: 'Taizhou B' }, institutions);
    institutions.push(second);

    expect(second.id).not.toBe(first.id);
    expect(() => reconcileInstitution({ institutionOfficial: 'Taizhou University' }, institutions))
      .toThrow(/Ambiguous English-only institution/u);
  });

  it('retains alternate English source spellings on the canonical Chinese institution', () => {
    const institutions = [{
      id: 'beihang',
      nameZh: 'Beihang Chinese',
      nameEn: 'Beihang University',
      aliases: [],
    }];

    const resolved = reconcileInstitution({
      institutionOfficial: 'Beihang University (formerly known as Beijing University of Aeronautics and Astronautics)',
      institutionNameZh: 'Beihang Chinese',
    }, institutions);

    expect(resolved.id).toBe('beihang');
    expect(resolved.aliases).toContain('Beihang University (formerly known as Beijing University of Aeronautics and Astronautics)');
  });

  it('persists an accepted alias-only reconciliation update', async () => {
    const paths = await createFiles([facts(1)[0]]);
    const trusted = { id: 'institution-1', nameZh: 'Chinese institution-1', nameEn: 'English institution-1', aliases: [] };
    await writeFile(paths.institutionsPath, `${JSON.stringify([trusted])}\n`);
    const configuredSource = { ...source, parser: { ...source.parser, guard: { minimumRecords: 1, maximumRecords: 1, maximumRemovalRatio: 0 } } };

    const result = await syncRegisteredSources({
      ...paths, sources: [configuredSource], fetchImpl: vi.fn().mockResolvedValue(acceptedResponse()),
      extractFacts: async (_source, _response, { institutions }) => [
        { ...facts(1)[0], institutionOfficial: 'Reviewed alias', institutionId: reconcileInstitution({ institutionOfficial: 'Reviewed alias', institutionNameZh: trusted.nameZh }, institutions).id },
      ],
    });

    expect(result.institutions[0].aliases).toContain('Reviewed alias');
    expect(JSON.parse(await readFile(paths.institutionsPath, 'utf8'))[0].aliases).toContain('Reviewed alias');
  });

  it('does not leak a rejected alias mutation into the next accepted source update', async () => {
    const paths = await createFiles([facts(1)[0]]);
    const trusted = { id: 'institution-1', nameZh: 'Chinese institution-1', nameEn: 'English institution-1', aliases: [] };
    await writeFile(paths.institutionsPath, `${JSON.stringify([trusted])}\n`);
    const rejected = { ...source, id: 'rejected-source', parser: { ...source.parser, guard: { minimumRecords: 2, maximumRecords: 2, maximumRemovalRatio: 0 } } };
    const accepted = { ...source, id: 'accepted-source', parser: { ...source.parser, guard: { minimumRecords: 1, maximumRecords: 1, maximumRemovalRatio: 0 } } };

    const result = await syncRegisteredSources({
      ...paths, sources: [rejected, accepted], fetchImpl: vi.fn().mockResolvedValue(acceptedResponse()),
      extractFacts: async (registeredSource, _response, { institutions }) => {
        if (registeredSource.id === 'rejected-source') {
          reconcileInstitution({ institutionOfficial: 'Rejected alias', institutionNameZh: trusted.nameZh }, institutions);
          return [{ ...facts(1)[0], sourceId: 'rejected-source', institutionId: trusted.id }];
        }
        institutions.push({ id: 'new-record', nameZh: 'New Chinese', nameEn: 'New English', aliases: [] });
        return [{ ...facts(1)[0], sourceId: 'accepted-source', institutionId: 'new-record' }];
      },
    });

    expect(result.institutions.find((record) => record.id === trusted.id)?.aliases).toEqual([]);
    expect(JSON.parse(await readFile(paths.institutionsPath, 'utf8')).find((record) => record.id === trusted.id)?.aliases).toEqual([]);
  });

  it('does not add a bilingual source spelling as an alias when another Chinese institution already claims it', () => {
    const correctChineseRecord = {
      id: 'correct', nameZh: 'Correct Chinese', nameEn: 'Correct University', aliases: [],
    };
    const conflictingEnglishRecord = {
      id: 'conflicting', nameZh: 'Different Chinese', nameEn: 'Conflicting University', aliases: [],
    };
    const institutions = [correctChineseRecord, conflictingEnglishRecord];

    const resolved = reconcileInstitution({
      institutionOfficial: 'Conflicting University',
      institutionNameZh: 'Correct Chinese',
    }, institutions);

    expect(resolved).toBe(correctChineseRecord);
    expect(correctChineseRecord.aliases).not.toContain('Conflicting University');
    expect(reconcileInstitution({ institutionOfficial: 'Conflicting University' }, institutions))
      .toBe(conflictingEnglishRecord);
  });

  it('uses an unambiguous normalized English lookup key without altering the official row text', () => {
    const institutions = [{
      id: 'beihang', nameZh: 'Beihang Chinese', nameEn: 'Beihang University', aliases: [],
    }, {
      id: 'mining', nameZh: 'Mining Chinese', nameEn: 'China University of Mining and Technology Beijing', aliases: [],
    }, {
      id: 'chemical', nameZh: 'Chemical Chinese', nameEn: 'Beijing University of Chemical Technology', aliases: [],
    }, {
      id: 'taizhou-a', nameZh: 'Taizhou A', nameEn: 'Taizhou University', aliases: [],
    }, {
      id: 'taizhou-b', nameZh: 'Taizhou B', nameEn: 'Taizhou University', aliases: [],
    }];

    expect(reconcileInstitution({ institutionOfficial: 'Beihang University (formerly known as Beijing University of Aeronautics and Astronautics)' }, institutions).id)
      .toBe('beihang');
    expect(reconcileInstitution({ institutionOfficial: 'China University of Mining & Technology (Beijing)' }, institutions).id)
      .toBe('mining');
    expect(reconcileInstitution({ institutionOfficial: 'Beijing University of Chemical Technology (80-84% for Chemical Engineering and Technology*)' }, institutions).id)
      .toBe('chemical');
    expect(() => reconcileInstitution({ institutionOfficial: 'Taizhou University' }, institutions))
      .toThrow(/Ambiguous English-only institution/u);
  });

  it('resolves Cambridge, Bristol, and Warwick source spellings with deterministic lookup variants only', () => {
    const institutions = [{
      id: 'huazhong', nameZh: 'Huazhong Chinese', nameEn: 'Huazhong Normal University / Central China Normal University', aliases: [],
    }, {
      id: 'central-fine-arts', nameZh: 'Central Fine Arts Chinese', nameEn: 'Central Academy of Fine Arts', aliases: [],
    }, {
      id: 'ucass', nameZh: 'UCASS Chinese', nameEn: 'University of Chinese Academy of Social Sciences', aliases: [],
    }];

    expect(reconcileInstitution({ institutionOfficial: 'Huazhong Normal University' }, institutions).id).toBe('huazhong');
    expect(reconcileInstitution({ institutionOfficial: 'China Central Academy of Fine Arts (Specialist institution: Programme limitations may apply)' }, institutions).id)
      .toBe('central-fine-arts');
    expect(reconcileInstitution({ institutionOfficial: 'University of Chinese Academy of Social Sciences (UCASS)' }, institutions).id)
      .toBe('ucass');
  });

  it('rejects a China-prefix lookup when more than one registered institution would match', () => {
    const institutions = [{
      id: 'central-fine-arts', nameZh: 'Central Fine Arts Chinese', nameEn: 'Central Academy of Fine Arts', aliases: [],
    }, {
      id: 'china-central-fine-arts', nameZh: 'China Central Fine Arts Chinese', nameEn: 'China Central Academy of Fine Arts', aliases: [],
    }];

    expect(() => reconcileInstitution({ institutionOfficial: 'China Central Academy of Fine Arts' }, institutions))
      .toThrow(/Ambiguous English-only institution/u);
  });

  it('reconciles every reviewed Bristol and Warwick row once while preserving its raw official spelling', () => {
    const expectedIds = new Map([
      ['Chinese University of Hong Kong, Shenzen', 'cn-4ca65817c8ab1919'],
      ['Guangzhou Medical University', 'cn-992cbbacda23f7e8'],
      ['Naval Medical University', 'cn-9f87dd4ea325c693'],
      ["People's Liberation Army Information Engineering University", 'cn-d95f2b81c571f42a'],
      ['Shanghai Ocean University', 'cn-cfc7b6e5ea305c78'],
      ['Shanghai University of Sport (Specialist institution: Programme limitations may apply)', 'cn-b0c5ad9361839895'],
      ['Shenzhen MSU-BIT', 'shenzhen-moscow-state-university-and-beijing-institute-of-technology-university-85730974'],
      ['Sichuan Agriculture University', 'sichuan-agricultural-university-2e7fba53'],
      ['Third Military Medical University', 'cn-b46c5842544c231d'],
      ['Xizang University (Tibet University)', 'tibet-university-44adba65'],
      ['Air Force Medical University of PLA (the Fourth Military Medical University)', 'cn-09f63fd100d867b1'],
      ['China University of Petroleum (Beijing and Karamay campuses)', 'cn-7a4cca60fac91630'],
      ['Army Medical University (the Third Military Medical University)', 'cn-b46c5842544c231d'],
      ['Chengdu University of TCM', 'cn-0e85934d3cd50718'],
      ['Eurasian International School of Henan University (for students enrolled from 2018 onwards*)', 'cn-3eaf09e6df3f834d'],
      ['Fuzhou University, Ocean College', 'cn-b5768b8f60c9fc41'],
      ['Harbin Medical University, Daqing (for Psychiatry major only*)', 'cn-5aef3969068d2b4a'],
      ['Henan University International Business School (formerly International Education College/School of International Education, Henan University (for students enrolled from 2018 onwards*)', 'cn-b616fa31750e7226'],
      ["Officers College Chinese People's Armed Police", 'cn-a409773bfcdfb4b9'],
      ['PLA Army Engineering University', 'cn-9020ed9eafa38063'],
      ['PLA Information Engineering University', 'cn-d95f2b81c571f42a'],
      ['PLA Nanjing Political College', 'cn-851e93756d3aa17f'],
      ['PLA Space Engineering University', 'cn-7933a994467dbd1c'],
      ['Shanghai Ocean University (82-89% for Aquatic Product*)', 'cn-cfc7b6e5ea305c78'],
      ['Shanghai University of Sport', 'cn-b0c5ad9361839895'],
      ['Shanghai University of Traditional Chinese Medicine (82-89% for Traditional Chinese Medicine (TCM) or Chinese Pharmacy*)', 'cn-4cb8ebbd13c8f9a0'],
      ['Hubei Academy of Fine Arts (for Arts Majors only*)', 'cn-ba0f44492e04e278'],
      ['Shanghai University, SHU-UTS SILC Business School (Sydney Institute of Language and Commerce)', 'cn-a4dde856833c3aa7'],
      ['Weifang Medical University', 'cn-c33b92447be76a83'],
    ]);

    for (const [officialName, expectedId] of expectedIds) {
      const rawFact = { institutionOfficial: officialName };
      expect(reconcileInstitution(rawFact, structuredClone(reviewedRegistry)).id).toBe(expectedId);
      expect(rawFact.institutionOfficial).toBe(officialName);
    }
  });

  it('maps every reviewed NUDT Chinese and English form to the pre-existing canonical record', () => {
    const institutions = [{
      id: 'national-university-of-defense-technology-471f1540',
      nameZh: 'NUDT short Chinese',
      nameEn: 'National University of Defense Technology **',
      aliases: [
        'NUDT formal Chinese',
        'National University of Defense Technology',
        'National University of Defence Technology',
        'The PLA National University of Defense Technology',
      ],
    }];

    for (const rawFact of [
      { institutionOfficial: 'National University of Defense Technology' },
      { institutionOfficial: 'National University of Defense Technology **' },
      { institutionOfficial: 'National University of Defence Technology (also known as The PLA National University of Defense Technology)' },
      { institutionOfficial: 'National University of Defense Technology', institutionNameZh: 'NUDT formal Chinese' },
    ]) {
      expect(reconcileInstitution(rawFact, institutions).id).toBe('national-university-of-defense-technology-471f1540');
    }
  });

  it('resolves Bristol’s reviewed Zhuhai Campus spelling to the bilingual canonical record', () => {
    const institutions = [{
      id: 'cn-d5e12e3100f1bfb3', nameZh: 'Zhuhai Chinese', nameEn: 'Beijing Normal University, Zhuhai',
      aliases: ['Beijing Normal University, Zhuhai Campus'],
    }];

    expect(reconcileInstitution({ institutionOfficial: 'Beijing Normal University, Zhuhai Campus' }, institutions).id)
      .toBe('cn-d5e12e3100f1bfb3');
  });

  it('commits a bilingual institution only when its guarded source update is accepted', async () => {
    const paths = await createFiles([]);
    const bilingualSource = {
      ...source,
      id: 'glasgow-china',
      parser: {
        mode: 'html-table',
        rowSelector: 'tr',
        institutionColumn: 0,
        nameZhColumn: 1,
        tierColumn: 2,
        guard: { minimumRecords: 2, maximumRecords: 2, maximumRemovalRatio: 0 },
      },
    };

    const result = await syncRegisteredSources({
      ...paths,
      sources: [bilingualSource],
      fetchImpl: vi.fn().mockResolvedValue(new Response('<table><tr><td>New University</td><td>æ–°å¤§å­¦</td><td>A</td></tr></table>', { status: 200 })),
      now: new Date('2026-08-02T10:00:00Z'),
    });

    expect(result.requirements).toEqual([]);
    expect(result.institutions).toEqual([]);
    expect(JSON.parse(await readFile(paths.institutionsPath, 'utf8'))).toEqual([]);
    expect(result.anomalies).toMatchObject([{ sourceId: 'glasgow-china', reason: 'below-minimum-records' }]);
  });

  it('explicitly deduplicates exact provider rows while retaining distinct official score rows', async () => {
    const paths = await createFiles([]);
    const provider = {
      ...source,
      id: 'sheffield-china',
      parser: {
        mode: 'html-table', rowSelector: 'tr', institutionColumn: 0, nameZhColumn: 1,
        scoreColumns: [{ label: '2:1', column: 2 }, { label: '2:2', column: 3 }],
        defaultTierOfficial: 'Ranking list', dedupeExactRows: true, allowMultipleFactsPerInstitution: true,
        guard: { minimumRecords: 2, maximumRecords: 2, maximumRemovalRatio: 0 },
      },
    };
    const html = '<table><tr><td>Guangdong Second Normal University</td><td>Guangdong Chinese</td><td>85%</td><td>80%</td></tr><tr><td>Guangdong Second Normal University</td><td>Guangdong Chinese</td><td>85%</td><td>80%</td></tr><tr><td>Guangdong University of Education</td><td>Guangdong Chinese</td><td>80%</td><td>75%</td></tr></table>';

    const result = await syncRegisteredSources({
      ...paths, sources: [provider], fetchImpl: vi.fn().mockResolvedValue(new Response(html, { status: 200 })),
      now: new Date('2026-08-02T10:00:00Z'),
    });

    expect(result.anomalies).toEqual([]);
    expect(result.institutions).toHaveLength(1);
    expect(result.institutions[0].aliases).toContain('Guangdong University of Education');
    expect(result.requirements).toHaveLength(2);
    expect(new Set(result.requirements.map((fact) => fact.id)).size).toBe(2);
    expect(new Set(result.requirements.map((fact) => fact.institutionId))).toEqual(new Set([result.institutions[0].id]));
    expect(result.requirements.map((fact) => fact.scoreOfficial).sort()).toEqual(['2:1: 80%;2:2: 75%', '2:1: 85%;2:2: 80%']);
  });

  it('uses the reviewed Chinese-anchored English alias when Glasgow PDF text repeats an English name', () => {
    const institutions = [
      { id: 'hunan', nameZh: 'Hunan Chinese', nameEn: 'Hunan Institute of Technology', aliases: [] },
      { id: 'anshan', nameZh: 'Anshan Chinese', nameEn: 'Hunan Institute of Technology', aliases: ['Anshan Normal University'] },
    ];
    const repaired = repairGlasgowBilingualPdfNames([
      { institutionOfficial: 'Hunan Institute of Technology', institutionNameZh: 'Hunan Chinese' },
      { institutionOfficial: 'Hunan Institute of Technology', institutionNameZh: 'Anshan Chinese' },
    ], institutions);

    expect(repaired[1].institutionOfficial).toBe('Anshan Normal University');
    expect(institutions[1]).toMatchObject({
      nameEn: 'Anshan Normal University',
      aliases: [],
    });
  });

  it('removes broken Glasgow parser names even when the repaired PDF facts are unique', () => {
    const institutions = [
      { id: 'hunan', nameZh: 'Hunan Chinese', nameEn: 'Hunan Institute of Technology', aliases: [] },
      { id: 'anshan', nameZh: 'Anshan Chinese', nameEn: 'Anshan Normal University', aliases: ['Hunan Institute of Technology'] },
      { id: 'fragment', nameZh: 'Fragment Chinese', nameEn: 'Technology', aliases: ['Gannan University of Science and Technology'] },
      { id: 'chaohu', nameZh: 'Chaohu Chinese', nameEn: 'Chaohu University', aliases: [] },
      { id: 'hezhou', nameZh: 'Hezhou Chinese', nameEn: 'Hezhou University', aliases: ['Chaohu University'] },
    ];
    const repaired = repairGlasgowBilingualPdfNames([
      { institutionOfficial: 'Hunan Institute of Technology', institutionNameZh: 'Hunan Chinese' },
      { institutionOfficial: 'Anshan Normal University', institutionNameZh: 'Anshan Chinese' },
      { institutionOfficial: 'Gannan University of Science and Technology', institutionNameZh: 'Fragment Chinese' },
      { institutionOfficial: 'Chaohu University', institutionNameZh: 'Chaohu Chinese' },
      { institutionOfficial: 'Hezhou University', institutionNameZh: 'Hezhou Chinese' },
    ], institutions);

    expect(repaired.map((fact) => fact.institutionOfficial)).toEqual([
      'Hunan Institute of Technology',
      'Anshan Normal University',
      'Gannan University of Science and Technology',
      'Chaohu University',
      'Hezhou University',
    ]);
    expect(institutions.find((record) => record.id === 'fragment')).toMatchObject({
      nameEn: 'Gannan University of Science and Technology',
      aliases: [],
    });
    expect(institutions.find((record) => record.id === 'anshan')?.aliases).not.toContain('Hunan Institute of Technology');
    expect(institutions.find((record) => record.id === 'hezhou')?.aliases).not.toContain('Chaohu University');
  });

  it('verifies registered PDF rule text from its text layer before extraction', async () => {
    const paths = await createFiles([]);
    const pdf = await readFile(new URL('./fixtures/sources/list-text-layer.pdf', import.meta.url));
    const pdfSource = {
      ...source,
      url: 'https://www.example.ac.uk/list.pdf',
      institutionRule: {
        type: 'grade-threshold', summaryZh: 'PDF-backed rule.', listedMeaningZh: 'Listed.', unlistedMeaningZh: 'Unlisted.',
        verification: { reviewedAt: '2026-08-02', url: 'https://www.example.ac.uk/china', requiredText: ['Priority List', 'Band A'] },
      },
      parser: {
        mode: 'pdf-text', headingPattern: '^University \\| Tier$', rowPattern: '^(Example University) \\| (Group 1)$',
        institutionColumn: 0, tierColumn: 1, guard: { minimumRecords: 1, maximumRecords: 1, maximumRemovalRatio: 0 },
      },
    };

    const result = await syncRegisteredSources({
      ...paths, sources: [pdfSource], institutions: [registeredInstitution],
      fetchImpl: vi.fn().mockImplementation((url) => new Response(
        url.endsWith('/china') ? '<p>Priority List: Band A</p>' : pdf,
        { status: 200, headers: { 'content-type': url.endsWith('/china') ? 'text/html' : 'application/pdf' } },
      )),
      now: new Date('2026-08-02T10:00:00Z'),
    });

    expect(result.anomalies).toEqual([]);
    expect(result.requirements).toHaveLength(1);
    expect(result.requirements[0].contentHash).toMatch(/^(?!e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855$)[a-f0-9]{64}$/u);
  });

  it.each([
    {
      name: 'violates the institution schema',
      candidate: { id: 'invalid-institution', nameZh: ' ', nameEn: 'Invalid University', aliases: [] },
    },
    {
      name: 'duplicates a registered raw institution name',
      candidate: { id: 'duplicate-institution', nameZh: 'Example Institution', nameEn: 'Different University', aliases: [] },
    },
    {
      name: 'leaves a requirement institution reference unregistered',
      factInstitutionId: 'missing-institution',
    },
  ])('rejects a candidate registry that $name before persistence', async ({ candidate, factInstitutionId }) => {
    const paths = await createFiles([]);
    const configuredSource = {
      ...source,
      parser: { ...source.parser, guard: { minimumRecords: 1, maximumRecords: 1, maximumRemovalRatio: 0 } },
    };
    const result = await syncRegisteredSources({
      ...paths,
      sources: [configuredSource],
      institutions: [registeredInstitution],
      fetchImpl: vi.fn().mockResolvedValue(acceptedResponse()),
      extractFacts: async (_source, _response, { institutions }) => {
        if (candidate) institutions.push(candidate);
        return facts(1, { institutionId: factInstitutionId ?? 'example-institution', institutionOfficial: 'Example University' });
      },
      now: new Date('2026-08-02T10:00:00Z'),
    });

    expect(result.requirements).toEqual([]);
    expect(result.institutions).toEqual([registeredInstitution]);
    expect(JSON.parse(await readFile(paths.requirementsPath, 'utf8'))).toEqual([]);
    expect(result.anomalies).toMatchObject([{ reason: 'candidate-institution-validation-failed', retainedTrustedFacts: true }]);
  });

  it('rolls back the bilingual registry when requirements promotion fails', async () => {
    const paths = await createFiles([]);
    const bilingualSource = {
      ...source,
      id: 'glasgow-china',
      parser: {
        mode: 'html-table',
        rowSelector: 'tr',
        institutionColumn: 0,
        nameZhColumn: 1,
        tierColumn: 2,
        guard: { minimumRecords: 1, maximumRecords: 1, maximumRemovalRatio: 0 },
      },
    };

    await expect(syncRegisteredSources({
      ...paths,
      sources: [bilingualSource],
      fetchImpl: vi.fn().mockResolvedValue(new Response('<table><tr><td>New University</td><td>æ–°å¤§å­¦</td><td>A</td></tr></table>', { status: 200 })),
      renameFile: async (from, to) => {
        if (to === paths.requirementsPath) throw new Error('requirements promotion failed');
        return rename(from, to);
      },
      now: new Date('2026-08-02T10:00:00Z'),
    })).rejects.toThrow('requirements promotion failed');

    expect(JSON.parse(await readFile(paths.institutionsPath, 'utf8'))).toEqual([]);
    expect(JSON.parse(await readFile(paths.requirementsPath, 'utf8'))).toEqual([]);
    await expect(access(`${paths.institutionsPath}.next`)).rejects.toThrow();
    await expect(access(`${paths.requirementsPath}.next`)).rejects.toThrow();
  });

  it('processes bilingual providers before earlier English-only sources and commits both accepted datasets', async () => {
    const paths = await createFiles([]);
    const englishOnlySource = {
      ...source,
      id: 'english-only-source',
      url: 'https://www.example.ac.uk/english-only',
      parser: {
        mode: 'html-list',
        selector: '#official-list',
        defaultTierOfficial: 'B',
        guard: { minimumRecords: 1, maximumRecords: 1, maximumRemovalRatio: 0 },
      },
    };
    const bilingualProvider = {
      ...source,
      id: 'glasgow-china',
      url: 'https://www.example.ac.uk/bilingual-provider',
      parser: {
        mode: 'html-table',
        rowSelector: 'tr',
        institutionColumn: 0,
        nameZhColumn: 1,
        tierColumn: 2,
        guard: { minimumRecords: 1, maximumRecords: 1, maximumRemovalRatio: 0 },
      },
    };
    const result = await syncRegisteredSources({
      ...paths,
      sources: [englishOnlySource, bilingualProvider],
      fetchImpl: vi.fn(async (url) => new Response(
        url.endsWith('bilingual-provider')
          ? '<table><tr><td>New University</td><td>æ–°å¤§å­¦</td><td>A</td></tr></table>'
          : '<ul id="official-list"><li>New University</li></ul>',
        { status: 200 },
      )),
      now: new Date('2026-08-02T10:00:00Z'),
    });

    expect(result.anomalies).toEqual([]);
    expect(result.requirements).toHaveLength(2);
    expect(result.requirements.map((fact) => fact.institutionId)).toEqual([result.institutions[0].id, result.institutions[0].id]);
    expect(result.institutions).toMatchObject([{ id: expect.stringMatching(/^cn-[a-f0-9]{16}$/u), nameEn: 'New University', nameZh: 'æ–°å¤§å­¦' }]);
    expect(JSON.parse(await readFile(paths.institutionsPath, 'utf8'))).toEqual(result.institutions);
  });

  it('reports an English-only unknown row without changing trusted institutions', async () => {
    const paths = await createFiles([]);
    const result = await syncRegisteredSources({
      ...paths,
      sources: [{
        ...source,
        parser: {
          mode: 'html-list',
          selector: '#official-list',
          defaultTierOfficial: 'A',
          guard: { minimumRecords: 1, maximumRecords: 1, maximumRemovalRatio: 0 },
        },
      }],
      fetchImpl: vi.fn().mockResolvedValue(new Response('<ul id="official-list"><li>Unknown English Only</li></ul>', { status: 200 })),
      now: new Date('2026-08-02T10:00:00Z'),
    });

    expect(result.requirements).toEqual([]);
    expect(result.institutions).toEqual([]);
    expect(JSON.parse(await readFile(paths.institutionsPath, 'utf8'))).toEqual([]);
    expect(result.anomalies).toMatchObject([{ reason: 'unknown-english-only-institution', retainedTrustedFacts: true }]);
  });

  it('preserves trusted facts, writes an anomaly, and leaves no candidate after a rejected removal', async () => {
    const previousRequirements = facts(100);
    const paths = await createFiles(previousRequirements);

    const result = await syncRegisteredSources({
      ...paths,
      sources: [source],
      fetchImpl: vi.fn().mockResolvedValue(acceptedResponse()),
      extractFacts: async () => facts(20),
      now: new Date('2026-08-01T10:00:00Z'),
    });

    expect(result.requirements).toEqual(previousRequirements);
    expect(JSON.parse(await readFile(paths.requirementsPath, 'utf8'))).toEqual(previousRequirements);
    expect(JSON.parse(await readFile(paths.anomaliesPath, 'utf8'))).toMatchObject([
      { sourceId: 'example-source', reason: 'removal-ratio-exceeded', retainedTrustedFacts: true },
    ]);
    await expect(access(`${paths.requirementsPath}.next`)).rejects.toThrow();
  });

  it('treats a temporary fetch error as status-only without replacing requirements', async () => {
    const previousRequirements = facts(100);
    const paths = await createFiles(previousRequirements, {
      'example-source': { health: 'ok', lastSuccessfulAt: '2026-07-31T10:00:00.000Z' },
    });

    const result = await syncRegisteredSources({
      ...paths,
      sources: [source],
      fetchImpl: vi.fn().mockRejectedValue(new TypeError('network unavailable')),
      now: new Date('2026-08-01T10:00:00Z'),
    });

    expect(result.requirements).toEqual(previousRequirements);
    expect(result.status['example-source']).toMatchObject({
      health: 'temporary-error',
      lastSuccessfulAt: '2026-07-31T10:00:00.000Z',
    });
    expect(JSON.parse(await readFile(paths.anomaliesPath, 'utf8'))).toEqual([]);
  });

  it('records a parser rejection without replacing trusted facts', async () => {
    const previousRequirements = facts(100);
    const paths = await createFiles(previousRequirements);
    const parserError = Object.assign(new Error('registered heading missing'), { code: 'PARSER_EMPTY' });

    const result = await syncRegisteredSources({
      ...paths,
      sources: [source],
      fetchImpl: vi.fn().mockResolvedValue(acceptedResponse()),
      extractFacts: async () => { throw parserError; },
      now: new Date('2026-08-01T10:00:00Z'),
    });

    expect(result.requirements).toEqual(previousRequirements);
    expect(result.status['example-source'].health).toBe('changed');
    expect(result.anomalies).toMatchObject([
      { sourceId: 'example-source', reason: 'parser-error', parserCode: 'PARSER_EMPTY' },
    ]);
  });

  it('stops before extraction when reviewed institution-rule anchors move', async () => {
    const previousRequirements = facts(100);
    const paths = await createFiles(previousRequirements);
    const extractFacts = vi.fn(async () => facts(102));
    const ruleSource = {
      ...source,
      institutionRule: {
        type: 'grade-threshold',
        summaryZh: 'Institution background changes the grade threshold.',
        listedMeaningZh: 'Listed threshold is 85%.',
        unlistedMeaningZh: 'Unlisted threshold is 90%.',
        verification: {
          reviewedAt: '2026-08-02',
          url: 'https://www.example.ac.uk/china-rule',
          requiredText: ['listed threshold 85%', 'unlisted threshold 90%'],
        },
      },
    };

    const result = await syncRegisteredSources({
      ...paths,
      sources: [ruleSource],
      fetchImpl: vi.fn().mockResolvedValue(new Response('<p>listed threshold 85%</p>', { status: 200 })),
      extractFacts,
      now: new Date('2026-08-02T10:00:00Z'),
    });

    expect(extractFacts).not.toHaveBeenCalled();
    expect(result.requirements).toEqual(previousRequirements);
    expect(result.status['example-source'].health).toBe('changed');
    expect(result.anomalies).toMatchObject([{
      reason: 'institution-rule-text-changed',
      ruleSourceUrl: 'https://www.example.ac.uk/china-rule',
      missingRequiredText: ['unlisted threshold 90%'],
    }]);
  });

  it('bounds parser-enabled source requests with a timeout', async () => {
    const paths = await createFiles(facts(100));
    const fetchImpl = vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));

    const result = await syncRegisteredSources({
      ...paths,
      sources: [source],
      fetchImpl,
      fetchTimeoutMs: 5,
      now: new Date('2026-08-02T10:00:00Z'),
    });

    expect(result.status['example-source'].health).toBe('temporary-error');
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('records a generic extraction rejection without replacing trusted facts', async () => {
    const previousRequirements = facts(100);
    const paths = await createFiles(previousRequirements);

    const result = await syncRegisteredSources({
      ...paths,
      sources: [source],
      fetchImpl: vi.fn().mockResolvedValue(acceptedResponse()),
      extractFacts: async () => { throw new Error('unexpected extraction failure'); },
      now: new Date('2026-08-01T10:00:00Z'),
    });

    expect(result.requirements).toEqual(previousRequirements);
    expect(result.status['example-source'].health).toBe('changed');
    expect(result.anomalies).toMatchObject([
      { sourceId: 'example-source', reason: 'extraction-error', retainedTrustedFacts: true },
    ]);
  });

  it('creates the anomaly output directory before recording a rejected candidate', async () => {
    const paths = await createFiles();
    paths.anomaliesPath = join(dirname(paths.anomaliesPath), 'artifacts', 'source-anomalies.json');

    await syncRegisteredSources({
      ...paths,
      sources: [source],
      fetchImpl: vi.fn().mockResolvedValue(acceptedResponse()),
      extractFacts: async () => facts(20),
      now: new Date('2026-08-01T10:00:00Z'),
    });

    expect(JSON.parse(await readFile(paths.anomaliesPath, 'utf8'))).toMatchObject([
      { reason: 'removal-ratio-exceeded' },
    ]);
  });

  it('atomically replaces only accepted facts for the updated source', async () => {
    const otherSourceFacts = facts(1, { id: 'other-fact', sourceId: 'other-source', universityId: 'other-university' });
    const paths = await createFiles([...facts(100), ...otherSourceFacts]);

    const result = await syncRegisteredSources({
      ...paths,
      sources: [source],
      fetchImpl: vi.fn().mockResolvedValue(acceptedResponse()),
      extractFacts: extractedFactsWithRegisteredInstitutions(102),
      now: new Date('2026-08-01T10:00:00Z'),
    });

    expect(result.requirements).toEqual([...facts(102), ...otherSourceFacts]);
    expect(JSON.parse(await readFile(paths.requirementsPath, 'utf8'))).toEqual([...facts(102), ...otherSourceFacts]);
    await expect(access(`${paths.requirementsPath}.next`)).rejects.toThrow();
  });

  it('rejects a candidate ID that collides with an unaffected source fact', async () => {
    const otherSourceFacts = facts(1, { id: 'example-fact-1', sourceId: 'other-source', universityId: 'other-university' });
    const previousRequirements = [...facts(100), ...otherSourceFacts];
    const paths = await createFiles(previousRequirements);

    const result = await syncRegisteredSources({
      ...paths,
      sources: [source],
      fetchImpl: vi.fn().mockResolvedValue(acceptedResponse()),
      extractFacts: extractedFactsWithRegisteredInstitutions(102),
      now: new Date('2026-08-01T10:00:00Z'),
    });

    expect(result.requirements).toEqual(previousRequirements);
    expect(result.anomalies).toMatchObject([{ reason: 'duplicate-fact-ids' }]);
  });

  it.each([
    {
      name: 'HTML table',
      fixture: new URL('./fixtures/sources/html-table.html', import.meta.url),
      contentType: 'text/html',
      parser: {
        mode: 'html-table',
        rowSelector: '#nested-list tbody > tr',
        institutionColumn: 1,
        tierColumn: 2,
        scoreColumn: 3,
      },
      expected: { tierOfficial: 'Band B', scoreOfficial: '75%' },
    },
    {
      name: 'PDF text layer',
      fixture: new URL('./fixtures/sources/list-text-layer.pdf', import.meta.url),
      contentType: 'application/pdf',
      parser: {
        mode: 'pdf-text',
        headingPattern: '^University \\| Tier$',
        rowPattern: '^(Example University) \\| (Group 1)$',
        institutionColumn: 0,
        tierColumn: 1,
      },
      expected: { tierOfficial: 'Group 1' },
    },
  ])('maps Task 3 $name output into schema-valid facts and atomically accepts it', async ({ fixture, contentType, parser, expected }) => {
    const paths = await createFiles([]);
    const fixtureBody = await readFile(fixture);
    const configuredSource = {
      ...source,
      parser: {
        ...parser,
        guard: { minimumRecords: 1, maximumRecords: 2, maximumRemovalRatio: 0 },
      },
    };

    const result = await syncRegisteredSources({
      ...paths,
      sources: [configuredSource],
      institutions: [registeredInstitution],
      fetchImpl: vi.fn().mockResolvedValue(new Response(fixtureBody, {
        status: 200,
        headers: { 'content-type': contentType },
      })),
      now: new Date('2026-08-01T10:00:00Z'),
    });

    expect(result.requirements).toHaveLength(1);
    expect(result.requirements[0]).toMatchObject({
      universityId: 'example-university',
      sourceId: 'example-source',
      institutionId: 'example-institution',
      institutionOfficial: 'Example University',
      scope: 'university',
      scopeZh: 'University-wide list',
      extractedAt: '2026-08-01T10:00:00.000Z',
      ...expected,
    });
    expect(result.requirements[0]).toMatchObject({
      id: expect.stringMatching(/^example-source-[a-f0-9]{16}$/u),
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(JSON.parse(await readFile(paths.requirementsPath, 'utf8'))).toEqual(result.requirements);
    await expect(access(`${paths.requirementsPath}.next`)).rejects.toThrow();
  });

  it('uses the registered official default tier for an HTML list row', async () => {
    const paths = await createFiles([]);
    const fixtureBody = await readFile(new URL('./fixtures/sources/html-list.html', import.meta.url));
    const configuredSource = {
      ...source,
      parser: {
        mode: 'html-list',
        selector: '#official-list',
        defaultTierOfficial: 'Official List Category A',
        guard: { minimumRecords: 1, maximumRecords: 2, maximumRemovalRatio: 0 },
      },
    };

    const result = await syncRegisteredSources({
      ...paths,
      sources: [configuredSource],
      institutions: [registeredInstitution],
      fetchImpl: vi.fn().mockResolvedValue(new Response(fixtureBody, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })),
      now: new Date('2026-08-01T10:00:00Z'),
    });

    expect(result.requirements).toMatchObject([{
      institutionId: 'example-institution',
      tierOfficial: 'Official List Category A',
      scopeZh: 'University-wide list',
    }]);
    expect(JSON.parse(await readFile(paths.requirementsPath, 'utf8'))).toEqual(result.requirements);
  });

  it('fetches registered parser sources serially with the configured gap', async () => {
    const secondFacts = facts(100).map((fact) => ({
      ...fact,
      id: fact.id.replace('example-', 'second-'),
      sourceId: 'second-source',
      universityId: 'second-university',
    }));
    const secondSource = { ...source, id: 'second-source', universityId: 'second-university', url: 'https://www.second.example.ac.uk/china-list', parser: { ...source.parser, guard: { ...guard, sourceId: 'second-source', universityId: 'second-university' } } };
    const paths = await createFiles([...facts(100), ...secondFacts]);
    const events = [];

    await syncRegisteredSources({
      ...paths,
      sources: [source, secondSource],
      fetchImpl: async (url) => {
        events.push(`fetch:${url}`);
        return acceptedResponse();
      },
      extractFacts: async (registeredSource) => {
        events.push(`extract:${registeredSource.id}`);
        return registeredSource.id === 'example-source'
          ? facts(100)
          : secondFacts;
      },
      wait: async (milliseconds) => events.push(`wait:${milliseconds}`),
      minimumGapMs: 600,
      now: new Date('2026-08-01T10:00:00Z'),
    });

    expect(events).toEqual([
      'fetch:https://www.example.ac.uk/china-list',
      'extract:example-source',
      'wait:600',
      'fetch:https://www.second.example.ac.uk/china-list',
      'extract:second-source',
    ]);
  });
});

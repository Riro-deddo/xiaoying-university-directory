import { access, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decideSourceUpdate, reconcileInstitution, syncRegisteredSources } from '../scripts/sync-sources.mjs';

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

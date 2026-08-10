import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { runRankingEditionCheck } from '../scripts/check-ranking-editions.mjs';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

async function runCli(scenario) {
  const root = await mkdtemp(join(tmpdir(), 'xiaoying-ranking-editions-cli-'));
  const scripts = join(root, 'scripts');
  const rankings = {
    releases: [{
      provider: 'qs',
      edition: 2027,
      sourceUrl: 'https://www.topuniversities.com/world-university-rankings?countries=gb',
    }],
    records: [],
  };

  await mkdir(join(root, 'src', 'data'), { recursive: true });
  await mkdir(scripts, { recursive: true });
  await writeFile(join(root, 'src', 'data', 'rankings.json'), `${JSON.stringify(rankings)}\n`, 'utf8');
  await copyFile(join(repositoryRoot, 'scripts', 'check-ranking-editions.mjs'), join(scripts, 'check-ranking-editions.mjs'));
  await copyFile(join(repositoryRoot, 'scripts', 'ranking-edition-monitor.mjs'), join(scripts, 'ranking-edition-monitor.mjs'));

  const preloadPath = join(root, 'offline-fetch.mjs');
  await writeFile(preloadPath, [
    "const scenario = process.env.RANKING_EDITION_SCENARIO;",
    "globalThis.fetch = async () => scenario === 'unavailable'",
    "  ? new Response('blocked', { status: 503 })",
    "  : new Response(scenario === 'current'",
    "    ? '<title>QS World University Rankings 2027</title>'",
    "    : scenario === 'new-edition'",
    "      ? '<title>QS World University Rankings 2028</title>'",
    "      : '<title>University rankings</title>');",
  ].join('\n'), 'utf8');

  const outcome = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      '--import',
      pathToFileURL(preloadPath).href,
      join(scripts, 'check-ranking-editions.mjs'),
    ], {
      env: { ...process.env, RANKING_EDITION_SCENARIO: scenario },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });

  return { root, outcome };
}

describe('ranking edition check runner', () => {
  it('atomically writes an audit artifact without writing ranking provenance', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xiaoying-ranking-editions-'));
    const rankingsPath = join(root, 'src', 'data', 'rankings.json');
    const auditPath = join(root, 'artifacts', 'ranking-edition-audit.json');
    const rankings = {
      releases: [{
        provider: 'qs',
        edition: 2027,
        sourceUrl: 'https://www.topuniversities.com/world-university-rankings?countries=gb',
      }],
      records: [{ universityId: 'example', provider: 'qs', edition: 2027 }],
    };
    const persistedRankings = '{"sentinel":"must remain unchanged"}\n';

    try {
      await mkdir(join(root, 'src', 'data'), { recursive: true });
      await writeFile(rankingsPath, persistedRankings, 'utf8');

      const result = await runRankingEditionCheck({
        root,
        rankings,
        fetchImpl: vi.fn().mockResolvedValue(new Response('<title>QS World University Rankings 2028</title>')),
        checkedAt: '2026-08-10T09:08:07.000Z',
      });

      expect(result).toEqual({
        checkedAt: '2026-08-10T09:08:07.000Z',
        results: [{
          provider: 'qs',
          sourceUrl: rankings.releases[0].sourceUrl,
          reviewedEdition: 2027,
          detectedEdition: 2028,
          status: 'new-edition',
          checkedAt: '2026-08-10T09:08:07.000Z',
        }],
      });
      expect(JSON.parse(await readFile(auditPath, 'utf8'))).toEqual(result);
      expect(existsSync(`${auditPath}.next`)).toBe(false);
      expect(await readFile(rankingsPath, 'utf8')).toBe(persistedRankings);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('reads releases from rankings.json when rankings are not injected', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xiaoying-ranking-editions-read-'));
    const rankingsPath = join(root, 'src', 'data', 'rankings.json');
    const rankings = {
      releases: [{
        provider: 'the',
        edition: 2026,
        sourceUrl: 'https://www.timeshighereducation.com/student/best-universities/best-universities-UK',
      }],
      records: [],
    };

    try {
      await mkdir(join(root, 'src', 'data'), { recursive: true });
      await writeFile(rankingsPath, `${JSON.stringify(rankings)}\n`, 'utf8');

      const result = await runRankingEditionCheck({
        root,
        fetchImpl: vi.fn().mockResolvedValue(new Response('<h1>World University Rankings 2026</h1>')),
        checkedAt: '2026-08-10T09:08:07.000Z',
      });

      expect(result.results).toEqual([expect.objectContaining({
        provider: 'the',
        reviewedEdition: 2026,
        status: 'current',
      })]);
      expect(JSON.parse(await readFile(rankingsPath, 'utf8'))).toEqual(rankings);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not allow path options to redirect provenance reads or audit writes outside root', async () => {
    const base = await mkdtemp(join(tmpdir(), 'xiaoying-ranking-editions-paths-'));
    const root = join(base, 'root');
    const redirectedRankingsPath = join(base, 'redirected', 'rankings.json');
    const redirectedAuditPath = join(base, 'redirected', 'audit.json');
    const rootRankings = {
      releases: [{
        provider: 'qs',
        edition: 2027,
        sourceUrl: 'https://www.topuniversities.com/world-university-rankings?countries=gb',
      }],
      records: [],
    };
    const redirectedRankings = {
      releases: [{
        provider: 'qs',
        edition: 2028,
        sourceUrl: 'https://www.example.com/not-production-provenance',
      }],
      records: [],
    };

    try {
      await mkdir(join(root, 'src', 'data'), { recursive: true });
      await mkdir(dirname(redirectedRankingsPath), { recursive: true });
      await writeFile(join(root, 'src', 'data', 'rankings.json'), `${JSON.stringify(rootRankings)}\n`, 'utf8');
      await writeFile(redirectedRankingsPath, `${JSON.stringify(redirectedRankings)}\n`, 'utf8');

      const result = await runRankingEditionCheck({
        root,
        rankingsPath: redirectedRankingsPath,
        auditPath: redirectedAuditPath,
        fetchImpl: vi.fn().mockResolvedValue(new Response('<title>QS World University Rankings 2027</title>')),
        checkedAt: '2026-08-10T09:08:07.000Z',
      });

      expect(result.results[0]).toMatchObject({ reviewedEdition: 2027, status: 'current' });
      expect(existsSync(join(root, 'artifacts', 'ranking-edition-audit.json'))).toBe(true);
      expect(existsSync(redirectedAuditPath)).toBe(false);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it.each(['current', 'new-edition', 'unverified', 'unavailable'])(
    'exits zero after recording the %s page-level outcome',
    async (scenario) => {
      const { root, outcome } = await runCli(scenario);

      try {
        expect(outcome).toMatchObject({ status: 0, stderr: '' });
        expect(outcome.stdout.trim().split(/\r?\n/u)).toHaveLength(1);
        const audit = JSON.parse(await readFile(join(root, 'artifacts', 'ranking-edition-audit.json'), 'utf8'));
        expect(audit.results[0].status).toBe(scenario);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );
});

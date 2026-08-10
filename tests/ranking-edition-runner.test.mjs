import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runRankingEditionCheck } from '../scripts/check-ranking-editions.mjs';

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
});

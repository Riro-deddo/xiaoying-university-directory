import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runSourceChecks } from '../scripts/check-sources.mjs';

const acceptedRequirementsHash = '073161e41bae112ec5f0bfbaf37abef49c5126b3292fd7a167cefe4a5ddf2c0c';
const observedRequirementsHash = 'c41057ea19a882bf56861a2807edaab496db5baf9042189c59c0db39f2b27fe0';

describe('check-sources command', () => {
  it('writes every attempt to an audit artifact and persists a successful check date', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'xiaoying-source-audit-'));

    try {
      const previousStatus = {
        'source-1': {
          sourceId: 'source-1',
          health: 'ok',
          checkedAt: '2026-08-07T03:17:00.000Z',
          lastSuccessfulAt: '2026-08-07T03:17:00.000Z',
          httpStatus: 200,
          finalUrl: 'https://www.example.ac.uk/china',
          contentHash: acceptedRequirementsHash,
          consecutiveFailures: 0,
        },
      };
      const result = await runSourceChecks({
        root: temporaryRoot,
        sources: [{ id: 'source-1', url: 'https://www.example.ac.uk/china' }],
        previous: previousStatus,
        fetchImpl: vi.fn().mockImplementation(() => new Response(
          '<html>official requirements</html>',
          { status: 200, headers: { 'content-type': 'text/html' } },
        )),
        now: new Date('2026-08-10T03:17:00.000Z'),
        minimumGapMs: 0,
      });

      expect(result.statusChanged).toBe(true);
      expect(result.status['source-1']).toMatchObject({
        health: 'ok',
        contentHash: acceptedRequirementsHash,
        lastSuccessfulAt: '2026-08-10T03:17:00.000Z',
      });

      const auditPath = join(temporaryRoot, 'artifacts', 'source-audit.json');
      expect(existsSync(auditPath)).toBe(true);
      const audit = JSON.parse(await readFile(auditPath, 'utf8'));
      expect(audit['source-1']).toMatchObject({
        sourceId: 'source-1',
        health: 'ok',
        contentHash: acceptedRequirementsHash,
        consecutiveFailures: 0,
      });
      expect(audit['source-1'].lastSuccessfulAt).toBe('2026-08-10T03:17:00.000Z');
      const persisted = JSON.parse(await readFile(join(temporaryRoot, 'src', 'data', 'status.json'), 'utf8'));
      expect(persisted['source-1'].lastSuccessfulAt).toBe('2026-08-10T03:17:00.000Z');
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('persists a fresh successful date when an observed-only 200 is followed by 304', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'xiaoying-source-observation-'));

    try {
      const initialStatus = {
        'source-1': {
          sourceId: 'source-1',
          health: 'ok',
          checkedAt: '2026-08-07T03:17:00.000Z',
          finalUrl: 'https://www.example.ac.uk/china',
          consecutiveFailures: 0,
        },
      };

      const first = await runSourceChecks({
        root: temporaryRoot,
        sources: [{ id: 'source-1', url: 'https://www.example.ac.uk/china' }],
        previous: initialStatus,
        fetchImpl: vi.fn().mockImplementation(() => new Response(
          '<html>official requirements</html>',
          { status: 200, headers: { 'content-type': 'text/html', etag: 'observed-etag' } },
        )),
        now: new Date('2026-08-09T03:17:00.000Z'),
        minimumGapMs: 0,
      });
      expect(first.status['source-1']).toMatchObject({
        health: 'ok',
        observedContentHash: acceptedRequirementsHash,
        etag: 'observed-etag',
        consecutiveFailures: 0,
        lastSuccessfulAt: '2026-08-09T03:17:00.000Z',
      });

      const second = await runSourceChecks({
        root: temporaryRoot,
        sources: [{ id: 'source-1', url: 'https://www.example.ac.uk/china' }],
        previous: first.status,
        fetchImpl: vi.fn().mockResolvedValue(new Response(null, { status: 304 })),
        now: new Date('2026-08-10T03:17:00.000Z'),
        minimumGapMs: 0,
      });

      expect(second.statusChanged).toBe(true);
      expect(second.status['source-1'].lastSuccessfulAt).toBe('2026-08-10T03:17:00.000Z');
      const persisted = JSON.parse(await readFile(join(temporaryRoot, 'src', 'data', 'status.json'), 'utf8'));
      expect(persisted['source-1'].lastSuccessfulAt).toBe('2026-08-10T03:17:00.000Z');
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('separates each attempt fingerprint from a persisted pending observation', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'xiaoying-source-attempt-fingerprint-'));
    const source = { id: 'source-1', url: 'https://www.example.ac.uk/china' };
    const initialStatus = {
      'source-1': {
        sourceId: 'source-1',
        health: 'ok',
        contentHash: acceptedRequirementsHash,
        consecutiveFailures: 0,
      },
    };

    try {
      const changed = await runSourceChecks({
        root: temporaryRoot,
        sources: [source],
        previous: initialStatus,
        fetchImpl: vi.fn().mockResolvedValue(new Response('<html>new official requirements</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })),
        now: new Date('2026-08-09T03:17:00.000Z'),
        minimumGapMs: 0,
      });
      const changedAudit = JSON.parse(await readFile(join(temporaryRoot, 'artifacts', 'source-audit.json'), 'utf8'));

      expect(changedAudit['source-1']).toMatchObject({
        health: 'changed',
        observedContentHash: observedRequirementsHash,
        attemptObservedContentHash: observedRequirementsHash,
      });
      expect(changed.status['source-1']).toMatchObject({
        health: 'changed',
        observedContentHash: observedRequirementsHash,
      });
      expect(changed.status['source-1']).not.toHaveProperty('attemptObservedContentHash');

      const failed = await runSourceChecks({
        root: temporaryRoot,
        sources: [source],
        previous: { 'source-1': { ...changed.status['source-1'], consecutiveFailures: 2 } },
        fetchImpl: vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })),
        now: new Date('2026-08-10T03:17:00.000Z'),
        minimumGapMs: 0,
      });
      const failedAudit = JSON.parse(await readFile(join(temporaryRoot, 'artifacts', 'source-audit.json'), 'utf8'));

      expect(failedAudit['source-1']).toMatchObject({
        health: 'temporary-error',
        observedContentHash: observedRequirementsHash,
      });
      expect(failedAudit['source-1']).not.toHaveProperty('attemptObservedContentHash');
      expect(failed.status['source-1']).toMatchObject({ observedContentHash: observedRequirementsHash });
      expect(failed.status['source-1']).not.toHaveProperty('attemptObservedContentHash');
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});

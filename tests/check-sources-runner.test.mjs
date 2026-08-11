import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { loadCheckTargets, runSourceChecks } from '../scripts/check-sources.mjs';

const acceptedRequirementsHash = '073161e41bae112ec5f0bfbaf37abef49c5126b3292fd7a167cefe4a5ddf2c0c';
const observedRequirementsHash = 'c41057ea19a882bf56861a2807edaab496db5baf9042189c59c0db39f2b27fe0';
const now1 = new Date('2026-08-08T03:17:00.000Z');
const now2 = new Date('2026-08-09T03:17:00.000Z');

describe('check-sources command', () => {
  it('merges China sources before masters directories and rejects duplicate target IDs', () => {
    const chinaSources = [
      { id: 'china-one', universityId: 'one', url: 'https://one.example/china' },
      { id: 'china-two', universityId: 'two', url: 'https://two.example/china' },
    ];
    const mastersCourseDirectories = [
      { id: 'masters-one', universityId: 'one', url: 'https://one.example/masters' },
    ];

    expect(loadCheckTargets({ chinaSources, mastersCourseDirectories }))
      .toEqual([...chinaSources, ...mastersCourseDirectories]);
    expect(() => loadCheckTargets({
      chinaSources,
      mastersCourseDirectories: [{ ...mastersCourseDirectories[0], id: 'china-two' }],
    })).toThrow(/duplicate check target id: china-two/u);
  });

  it('rejects a non-HTTPS target before any check runs', () => {
    expect(() => loadCheckTargets({
      chinaSources: [{ id: 'china-one', universityId: 'one', url: 'http://one.example/china' }],
      mastersCourseDirectories: [],
    })).toThrow(/HTTPS/u);
  });

  it('does not persist an ordinary page identity timestamp refresh', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'xiaoying-page-identity-noise-'));
    const source = {
      id: 'masters-one',
      universityId: 'one',
      url: 'https://one.example/masters',
      monitorMode: 'page-identity',
      requiredText: ['Postgraduate courses'],
    };
    const previousStatus = {
      'masters-one': {
        sourceId: 'masters-one',
        health: 'ok',
        checkedAt: now1.toISOString(),
        lastSuccessfulAt: now1.toISOString(),
        httpStatus: 200,
        finalUrl: source.url,
        consecutiveFailures: 0,
      },
    };

    try {
      const result = await runSourceChecks({
        root: temporaryRoot,
        sources: [source],
        previous: previousStatus,
        fetchImpl: vi.fn().mockResolvedValue(new Response('<h1>Postgraduate courses</h1>', { status: 200 })),
        now: now2,
        minimumGapMs: 0,
      });

      expect(result.statusChanged).toBe(false);
      expect(result.status).toEqual(previousStatus);
      expect(result.attempts['masters-one']).toMatchObject({
        checkedAt: now2.toISOString(),
        lastSuccessfulAt: now2.toISOString(),
      });
      expect(existsSync(join(temporaryRoot, 'src', 'data', 'status.json'))).toBe(false);
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('records a failed target and continues checking the next target', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'xiaoying-source-continuation-'));
    const sources = [
      {
        id: 'masters-one',
        universityId: 'one',
        url: 'https://one.example/masters',
        monitorMode: 'page-identity',
        requiredText: ['Postgraduate courses'],
      },
      {
        id: 'masters-two',
        universityId: 'two',
        url: 'https://two.example/masters',
        monitorMode: 'page-identity',
        requiredText: ['Postgraduate courses'],
      },
    ];
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new TypeError('network unavailable'))
      .mockResolvedValueOnce(new Response('<h1>Postgraduate courses</h1>', { status: 200 }));

    try {
      const result = await runSourceChecks({
        root: temporaryRoot,
        sources,
        previous: {},
        fetchImpl,
        now: now2,
        minimumGapMs: 0,
      });

      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(result.attempts['masters-one']).toMatchObject({
        health: 'unchecked',
        consecutiveFailures: 1,
        lastAttemptError: 'network unavailable',
      });
      expect(result.attempts['masters-two']).toMatchObject({
        health: 'ok',
        consecutiveFailures: 0,
      });
      const audit = JSON.parse(await readFile(join(temporaryRoot, 'artifacts', 'source-audit.json'), 'utf8'));
      expect(Object.keys(audit)).toEqual(['masters-one', 'masters-two']);
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

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

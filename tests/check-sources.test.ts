import { describe, expect, it, vi } from 'vitest';
import { checkSource } from '../scripts/source-checker.mjs';
import requirements from '../src/data/generated/requirements.json';
import status from '../src/data/status.json';
import type { SourceStatus } from '../src/lib/types';

const source = { id: 'source-1', url: 'https://www.example.ac.uk/china' };
const response = (status: number, headers: Record<string, string> = {}) =>
  new Response(status === 200 ? '<html>official requirements</html>' : null, { status, headers: { ...headers, 'content-type': 'text/html' } });
const failingFetch = (status: number) => vi.fn().mockResolvedValue(response(status));
const changedResponse = () => vi.fn().mockResolvedValue(new Response('<html>new official requirements</html>', {
  status: 200,
  headers: { 'content-type': 'text/html', etag: 'new-etag' },
}));
const now1 = new Date('2026-08-08T03:17:00.000Z');
const now2 = new Date('2026-08-09T03:17:00.000Z');
const now3 = new Date('2026-08-10T03:17:00.000Z');
const acceptedRequirementsHash = '073161e41bae112ec5f0bfbaf37abef49c5126b3292fd7a167cefe4a5ddf2c0c';
const observedRequirementsHash = 'c41057ea19a882bf56861a2807edaab496db5baf9042189c59c0db39f2b27fe0';

const okPrevious = (): SourceStatus => ({
  sourceId: source.id,
  health: 'ok',
  contentHash: acceptedRequirementsHash,
  consecutiveFailures: 0,
});

describe('checkSource', () => {
  it('records a successful source check', async () => {
    const result = await checkSource(source, vi.fn().mockResolvedValue(response(200, { etag: 'v1' })), undefined, new Date('2026-08-01T10:00:00Z'));
    expect(result).toMatchObject({ sourceId: 'source-1', health: 'ok', httpStatus: 200, etag: 'v1', lastSuccessfulAt: '2026-08-01T10:00:00.000Z' });
  });

  it('marks changed validators without losing success metadata', async () => {
    const previous = { sourceId: 'source-1', health: 'ok', etag: 'v1', lastSuccessfulAt: '2026-07-31T10:00:00.000Z' };
    const result = await checkSource(source, vi.fn().mockResolvedValue(response(200, { etag: 'v2' })), previous, new Date('2026-08-01T10:00:00Z'));
    expect(result.health).toBe('changed');
    expect(result.lastSuccessfulAt).toBe('2026-08-01T10:00:00.000Z');
  });

  it.each([
    { status: 403, exposedHealth: 'unavailable' },
    { status: 404, exposedHealth: 'unavailable' },
    { status: 429, exposedHealth: 'temporary-error' },
    { status: 500, exposedHealth: 'temporary-error' },
    { status: 503, exposedHealth: 'temporary-error' },
  ] as const)('does not expose HTTP $status access failure until the third consecutive attempt', async ({ status, exposedHealth }) => {
    const previous = { ...okPrevious(), lastSuccessfulAt: '2026-08-07T03:17:00.000Z' };
    const first = await checkSource(source, failingFetch(status), previous, now1);
    const second = await checkSource(source, failingFetch(status), first, now2);
    const third = await checkSource(source, failingFetch(status), second, now3);

    expect(first).toMatchObject({ health: 'ok', consecutiveFailures: 1, lastSuccessfulAt: previous.lastSuccessfulAt, httpStatus: status });
    expect(second).toMatchObject({ health: 'ok', consecutiveFailures: 2, lastSuccessfulAt: previous.lastSuccessfulAt, httpStatus: status });
    expect(third).toMatchObject({ health: exposedHealth, consecutiveFailures: 3, lastSuccessfulAt: previous.lastSuccessfulAt, httpStatus: status });
  });

  it('does not expose a timeout until the third consecutive attempt', async () => {
    const timeout = () => vi.fn().mockRejectedValue(new DOMException('timed out', 'AbortError'));
    const first = await checkSource(source, timeout(), okPrevious(), now1);
    const second = await checkSource(source, timeout(), first, now2);
    const third = await checkSource(source, timeout(), second, now3);

    expect(first).toMatchObject({ health: 'ok', consecutiveFailures: 1, lastAttemptError: 'timed out' });
    expect(second).toMatchObject({ health: 'ok', consecutiveFailures: 2, lastAttemptError: 'timed out' });
    expect(third).toMatchObject({ health: 'temporary-error', consecutiveFailures: 3, lastAttemptError: 'timed out' });
  });

  it('keeps the accepted hash while a changed hash awaits review', async () => {
    const result = await checkSource(source, changedResponse(), okPrevious(), now1);

    expect(result).toMatchObject({
      health: 'changed',
      contentHash: acceptedRequirementsHash,
      observedContentHash: observedRequirementsHash,
      lastSuccessfulAt: now1.toISOString(),
      consecutiveFailures: 0,
    });
  });

  it('keeps exposing an identical observed change until reviewed sync accepts it', async () => {
    const first = await checkSource(source, changedResponse(), okPrevious(), now1);
    const second = await checkSource(source, changedResponse(), first, now2);

    expect(second).toMatchObject({
      health: 'changed',
      contentHash: acceptedRequirementsHash,
      observedContentHash: observedRequirementsHash,
      consecutiveFailures: 0,
    });
  });

  it('resets failures and clears a stale observation after accepted content succeeds', async () => {
    const previous: SourceStatus = {
      ...okPrevious(),
      health: 'temporary-error',
      observedContentHash: observedRequirementsHash,
      consecutiveFailures: 3,
      lastAttemptError: 'service unavailable',
    };
    const result = await checkSource(source, vi.fn().mockResolvedValue(response(200)), previous, now1);

    expect(result).toMatchObject({
      health: 'ok',
      contentHash: acceptedRequirementsHash,
      consecutiveFailures: 0,
    });
    expect(result).not.toHaveProperty('observedContentHash');
    expect(result).not.toHaveProperty('lastAttemptError');
  });

  it('treats 304 as success while preserving a pending reviewed observation and validators', async () => {
    const previous: SourceStatus = {
      ...okPrevious(),
      health: 'changed',
      observedContentHash: observedRequirementsHash,
      consecutiveFailures: 2,
      etag: 'new-etag',
      lastModified: 'Sat, 08 Aug 2026 03:17:00 GMT',
    };
    const result = await checkSource(source, vi.fn().mockResolvedValue(response(304)), previous, now1);

    expect(result).toMatchObject({
      health: 'changed',
      contentHash: acceptedRequirementsHash,
      observedContentHash: observedRequirementsHash,
      consecutiveFailures: 0,
      etag: previous.etag,
      lastModified: previous.lastModified,
      lastSuccessfulAt: now1.toISOString(),
    });
  });

  it('hashes binary source bytes without text-decoding corruption', async () => {
    const acceptedBinaryHash = '5d8d910591d272938aef5f966e0816e374beaf7b5adf02cca5f8f770596c2ce3';
    const binaryResponse = () => new Response(new Uint8Array([0, 255, 1, 254]), {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    });
    const result = await checkSource(source, vi.fn().mockImplementation(binaryResponse), {
      sourceId: source.id,
      health: 'ok',
      contentHash: acceptedBinaryHash,
      consecutiveFailures: 0,
    }, now1);

    expect(result).toMatchObject({
      health: 'ok',
      contentHash: acceptedBinaryHash,
      consecutiveFailures: 0,
    });
    expect(result).not.toHaveProperty('observedContentHash');
  });

  it('uses accepted content instead of validator churn to decide public health', async () => {
    const result = await checkSource(source, vi.fn().mockResolvedValue(response(200, { etag: 'v2' })), {
      ...okPrevious(),
      etag: 'v1',
    }, now1);

    expect(result).toMatchObject({
      health: 'ok',
      contentHash: acceptedRequirementsHash,
      etag: 'v2',
      consecutiveFailures: 0,
    });
    expect(result).not.toHaveProperty('observedContentHash');
  });

  it('keeps a legacy changed state pending while capturing its first full observation', async () => {
    const result = await checkSource(source, changedResponse(), {
      sourceId: source.id,
      health: 'changed',
      etag: 'new-etag',
      consecutiveFailures: 0,
    }, now1);

    expect(result).toMatchObject({
      health: 'changed',
      observedContentHash: observedRequirementsHash,
      etag: 'new-etag',
      consecutiveFailures: 0,
    });
    expect(result).not.toHaveProperty('contentHash');
  });

  it('does not condition the first full observation of a legacy changed source', async () => {
    const fetcher = changedResponse();
    await checkSource(source, fetcher, {
      sourceId: source.id,
      health: 'changed',
      etag: 'new-etag',
      lastModified: 'Sat, 08 Aug 2026 03:17:00 GMT',
      consecutiveFailures: 0,
    }, now1);

    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [, request] of fetcher.mock.calls) {
      expect(request.headers).not.toHaveProperty('if-none-match');
      expect(request.headers).not.toHaveProperty('if-modified-since');
    }
  });

  it('keeps a captured legacy observation changed across a later 304', async () => {
    const observed = await checkSource(source, changedResponse(), {
      sourceId: source.id,
      health: 'changed',
      etag: 'new-etag',
      consecutiveFailures: 0,
    }, now1);
    const result = await checkSource(source, vi.fn().mockResolvedValue(response(304)), observed, now2);

    expect(result).toMatchObject({
      health: 'changed',
      observedContentHash: observedRequirementsHash,
      consecutiveFailures: 0,
    });
    expect(result).not.toHaveProperty('contentHash');
  });

  it('retains a healthy observed-only baseline across a later 304', async () => {
    const first = await checkSource(source, vi.fn().mockResolvedValue(response(200, { etag: 'observed-etag' })), {
      sourceId: source.id,
      health: 'ok',
      consecutiveFailures: 2,
    }, now1);
    const second = await checkSource(source, vi.fn().mockResolvedValue(response(304)), first, now2);

    expect(first).toMatchObject({
      health: 'ok',
      observedContentHash: acceptedRequirementsHash,
      etag: 'observed-etag',
      consecutiveFailures: 0,
    });
    expect(second).toMatchObject({
      health: 'ok',
      observedContentHash: acceptedRequirementsHash,
      etag: 'observed-etag',
      consecutiveFailures: 0,
    });
    expect(second).not.toHaveProperty('contentHash');
  });
});

describe('persisted source review baselines', () => {
  it('seeds failure counters and accepted hashes from reviewed facts', () => {
    const acceptedHashesBySource = new Map<string, Set<string>>();
    for (const fact of requirements) {
      const hashes = acceptedHashesBySource.get(fact.sourceId) ?? new Set<string>();
      hashes.add(fact.contentHash);
      acceptedHashesBySource.set(fact.sourceId, hashes);
    }

    for (const sourceStatus of Object.values(status) as SourceStatus[]) {
      expect(sourceStatus.consecutiveFailures).toBeGreaterThanOrEqual(0);
      if (['temporary-error', 'unavailable'].includes(sourceStatus.health)) {
        expect(sourceStatus.consecutiveFailures).toBeGreaterThanOrEqual(3);
      }
      const acceptedHashes = acceptedHashesBySource.get(sourceStatus.sourceId);
      if (acceptedHashes?.size === 1) {
        expect(sourceStatus.contentHash).toBe([...acceptedHashes][0]);
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import { expectUnacceptedLinkOnlyStatus } from './source-status';

describe('expectUnacceptedLinkOnlyStatus', () => {
  it('accepts reviewed lifecycle state while rejecting malformed and accepted-hash status', () => {
    expect(() => expectUnacceptedLinkOnlyStatus({
      sourceId: 'example-source',
      health: 'ok',
      consecutiveFailures: 0,
      checkedAt: '2026-08-10T03:17:00.000Z',
      lastSuccessfulAt: '2026-08-10T03:17:00.000Z',
      observedContentHash: 'a'.repeat(64),
    }, 'example-source')).not.toThrow();

    expect(() => expectUnacceptedLinkOnlyStatus({
      sourceId: 'example-source', health: 'invented', consecutiveFailures: 0,
    }, 'example-source')).toThrow();
    expect(() => expectUnacceptedLinkOnlyStatus({
      sourceId: 'example-source', health: 'ok', consecutiveFailures: -1,
    }, 'example-source')).toThrow();
    expect(() => expectUnacceptedLinkOnlyStatus({
      sourceId: 'example-source', health: 'ok', contentHash: 'b'.repeat(64),
    }, 'example-source')).toThrow();
    expect(() => expectUnacceptedLinkOnlyStatus({
      sourceId: 'example-source', health: 'ok', checkedAt: '',
    }, 'example-source')).toThrow();
    expect(() => expectUnacceptedLinkOnlyStatus({
      sourceId: 'example-source', health: 'ok', lastSuccessfulAt: 'not-an-iso-timestamp',
    }, 'example-source')).toThrow();
    expect(() => expectUnacceptedLinkOnlyStatus({
      sourceId: 'example-source', health: 'ok', observedContentHash: '',
    }, 'example-source')).toThrow();
    expect(() => expectUnacceptedLinkOnlyStatus({
      sourceId: 'example-source', health: 'ok', observedContentHash: 'not-a-sha256',
    }, 'example-source')).toThrow();
  });
});

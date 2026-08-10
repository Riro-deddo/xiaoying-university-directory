import { expect } from 'vitest';
import type { SourceHealth, SourceStatus } from '../../src/lib/types';

const allowedHealth = new Set<SourceHealth>([
  'unchecked', 'ok', 'redirected', 'changed', 'temporary-error', 'unavailable',
]);
const sha256 = /^[a-f0-9]{64}$/u;

export function expectUnacceptedLinkOnlyStatus(value: unknown, sourceId: string): void {
  expect(value).toEqual(expect.objectContaining({ sourceId }));
  const status = value as SourceStatus;
  expect(allowedHealth.has(status.health)).toBe(true);
  expect(status.consecutiveFailures ?? 0).toBeGreaterThanOrEqual(0);
  expect(status).not.toHaveProperty('contentHash');
  if (Object.hasOwn(status, 'checkedAt')) {
    expect(status.checkedAt).not.toBeNull();
    expect(typeof status.checkedAt).toBe('string');
    expect(Number.isNaN(Date.parse(status.checkedAt as string))).toBe(false);
  }
  if (Object.hasOwn(status, 'lastSuccessfulAt')) {
    expect(status.lastSuccessfulAt).not.toBeNull();
    expect(typeof status.lastSuccessfulAt).toBe('string');
    expect(Number.isNaN(Date.parse(status.lastSuccessfulAt as string))).toBe(false);
  }
  if (Object.hasOwn(status, 'observedContentHash')) {
    expect(status.observedContentHash).not.toBeNull();
    expect(typeof status.observedContentHash).toBe('string');
    expect(status.observedContentHash as string).toMatch(sha256);
  }
}

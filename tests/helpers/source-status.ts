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
  if (status.checkedAt) expect(Number.isNaN(Date.parse(status.checkedAt))).toBe(false);
  if (status.lastSuccessfulAt) expect(Number.isNaN(Date.parse(status.lastSuccessfulAt))).toBe(false);
  if (status.observedContentHash) expect(status.observedContentHash).toMatch(sha256);
}

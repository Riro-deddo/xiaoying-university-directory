import { describe, expect, it, vi } from 'vitest';
import { checkSource } from '../scripts/source-checker.mjs';

const source = { id: 'source-1', url: 'https://www.example.ac.uk/china' };
const response = (status: number, headers: Record<string, string> = {}) =>
  new Response(status === 200 ? '<html>official requirements</html>' : null, { status, headers: { ...headers, 'content-type': 'text/html' } });

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

  it.each([[429], [503]])('treats HTTP %s as temporary and retains last successful time', async (status) => {
    const previous = { sourceId: 'source-1', health: 'ok', lastSuccessfulAt: '2026-07-31T10:00:00.000Z' };
    const result = await checkSource(source, vi.fn().mockResolvedValue(response(status)), previous, new Date('2026-08-01T10:00:00Z'));
    expect(result).toMatchObject({ health: 'temporary-error', lastSuccessfulAt: previous.lastSuccessfulAt, httpStatus: status });
  });

  it('classifies 404 as unavailable', async () => {
    const result = await checkSource(source, vi.fn().mockResolvedValue(response(404)), undefined, new Date('2026-08-01T10:00:00Z'));
    expect(result.health).toBe('unavailable');
  });

  it('classifies a timeout as temporary', async () => {
    const fetcher = vi.fn().mockRejectedValue(new DOMException('timed out', 'AbortError'));
    const result = await checkSource(source, fetcher, undefined, new Date('2026-08-01T10:00:00Z'));
    expect(result.health).toBe('temporary-error');
  });
});

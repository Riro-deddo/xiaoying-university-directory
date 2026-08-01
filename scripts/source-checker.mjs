import { createHash } from 'node:crypto';

const timeoutMs = 12_000;

function base(source, previous, now) {
  return { sourceId: source.id, checkedAt: now.toISOString(), lastSuccessfulAt: previous?.lastSuccessfulAt };
}

export async function checkSource(source, fetchImpl = fetch, previous, now = new Date()) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { 'user-agent': 'Xiaoying-University-Directory/0.1 (+public educational link checker)' };
  if (previous?.etag) headers['if-none-match'] = previous.etag;
  if (previous?.lastModified) headers['if-modified-since'] = previous.lastModified;

  try {
    let result = await fetchImpl(source.url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers });
    if ([405, 501].includes(result.status)) result = await fetchImpl(source.url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers });
    const common = { ...base(source, previous, now), httpStatus: result.status, finalUrl: result.url || source.url };
    if (result.status === 304) return { ...common, health: 'ok', lastSuccessfulAt: now.toISOString(), etag: previous?.etag, lastModified: previous?.lastModified };
    if ([429, 500, 502, 503, 504].includes(result.status)) return { ...common, health: 'temporary-error' };
    if (!result.ok) return { ...common, health: 'unavailable' };

    const etag = result.headers.get('etag') ?? undefined;
    const lastModified = result.headers.get('last-modified') ?? undefined;
    let contentHash;
    if (!etag && !lastModified && result.body) contentHash = createHash('sha256').update(await result.text()).digest('hex');
    const changed = Boolean(
      (previous?.etag && etag && previous.etag !== etag) ||
      (previous?.lastModified && lastModified && previous.lastModified !== lastModified) ||
      (previous?.contentHash && contentHash && previous.contentHash !== contentHash),
    );
    return { ...common, health: changed ? 'changed' : (result.redirected ? 'redirected' : 'ok'), lastSuccessfulAt: now.toISOString(), etag, lastModified, contentHash };
  } catch (error) {
    return { ...base(source, previous, now), health: 'temporary-error', error: error instanceof Error ? error.message : 'unknown error' };
  } finally {
    clearTimeout(timer);
  }
}

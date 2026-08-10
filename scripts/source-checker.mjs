import { readAndHashSourceContent } from './source-content-hash.mjs';

const timeoutMs = 12_000;
const countedUnavailableStatuses = new Set([403, 404]);

function base(source, previous, now) {
  const {
    error: _legacyError,
    lastAttemptError: _lastAttemptError,
    attemptObservedContentHash: _attemptObservedContentHash,
    ...retained
  } = previous ?? {};
  return { ...retained, sourceId: source.id, checkedAt: now.toISOString() };
}

function isCountedTemporaryStatus(status) {
  return status === 429 || status >= 500 && status <= 599;
}

function failedAttempt(source, previous, now, patch, exposedHealth) {
  const consecutiveFailures = (previous?.consecutiveFailures ?? 0) + 1;
  return {
    ...base(source, previous, now),
    ...patch,
    health: consecutiveFailures >= 3 ? exposedHealth : (previous?.health ?? 'unchecked'),
    consecutiveFailures,
  };
}

function successfulAttempt(source, previous, now, result, contentHash) {
  const acceptedContentHash = previous?.contentHash;
  const previousObservedHash = previous?.observedContentHash;
  const etag = result.headers.get('etag') ?? (result.status === 304 ? previous?.etag : undefined);
  const lastModified = result.headers.get('last-modified') ?? (result.status === 304 ? previous?.lastModified : undefined);
  const validatorChanged = Boolean(
    (previous?.etag && etag && previous.etag !== etag)
    || (previous?.lastModified && lastModified && previous.lastModified !== lastModified)
  );
  const observedContentHash = contentHash ?? previousObservedHash;
  const contentChanged = Boolean(
    contentHash && (
      acceptedContentHash
        ? contentHash !== acceptedContentHash
        : previousObservedHash && contentHash !== previousObservedHash
    )
  );
  const pendingObservedChange = Boolean(
    acceptedContentHash && observedContentHash && observedContentHash !== acceptedContentHash
  );
  const legacyPendingReview = previous?.health === 'changed' && !acceptedContentHash;
  const changed = contentChanged
    || pendingObservedChange
    || (!acceptedContentHash && validatorChanged)
    || legacyPendingReview
    || (!contentHash && previous?.health === 'changed');
  const next = {
    ...base(source, previous, now),
    health: changed ? 'changed' : (result.redirected ? 'redirected' : 'ok'),
    lastSuccessfulAt: now.toISOString(),
    httpStatus: result.status,
    finalUrl: result.url || source.url,
    etag,
    lastModified,
    contentHash: acceptedContentHash,
    consecutiveFailures: 0,
  };
  if (!acceptedContentHash) delete next.contentHash;
  if ((contentHash && (contentChanged || pendingObservedChange || !acceptedContentHash))
    || (!contentHash && (pendingObservedChange || legacyPendingReview || !acceptedContentHash) && observedContentHash)) {
    next.observedContentHash = observedContentHash;
  } else {
    delete next.observedContentHash;
  }
  if (contentHash) next.attemptObservedContentHash = contentHash;
  return next;
}

export async function checkSource(source, fetchImpl = fetch, previous, now = new Date()) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { 'user-agent': 'Xiaoying-University-Directory/0.1 (+public educational link checker)' };
  if (previous?.contentHash || previous?.observedContentHash) {
    if (previous?.etag) headers['if-none-match'] = previous.etag;
    if (previous?.lastModified) headers['if-modified-since'] = previous.lastModified;
  }

  try {
    let result = await fetchImpl(source.url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers });
    if ([405, 501].includes(result.status)) {
      result = await fetchImpl(source.url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers });
    } else if (result.ok && result.status !== 304) {
      result = await fetchImpl(source.url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers });
    }
    const common = { ...base(source, previous, now), httpStatus: result.status, finalUrl: result.url || source.url };
    if (result.status === 304) {
      return successfulAttempt(source, previous, now, result, undefined);
    }
    if (countedUnavailableStatuses.has(result.status)) {
      return failedAttempt(source, previous, now, common, 'unavailable');
    }
    if (isCountedTemporaryStatus(result.status)) {
      return failedAttempt(source, previous, now, common, 'temporary-error');
    }
    if (!result.ok) return { ...common, health: 'unavailable' };

    let contentHash;
    if (result.body) {
      ({ contentHash } = await readAndHashSourceContent(result, result.url || source.url));
    }
    return successfulAttempt(source, previous, now, result, contentHash);
  } catch (error) {
    const lastAttemptError = error instanceof Error ? error.message : 'unknown error';
    return failedAttempt(source, previous, now, { lastAttemptError }, 'temporary-error');
  } finally {
    clearTimeout(timer);
  }
}

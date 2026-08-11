import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { anomalyIssuePayload } from './render-anomaly-issue.mjs';

const anomalousHealth = new Set(['changed', 'temporary-error', 'unavailable']);
const markerPattern = /<!-- (source-anomaly:[a-z0-9][a-z0-9._-]*) -->/gu;

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function indexSources(sources) {
  const sourceById = new Map();
  for (const source of sources) {
    if (sourceById.has(source.id)) throw new TypeError(`duplicate source id: ${source.id}`);
    sourceById.set(source.id, source);
  }
  return sourceById;
}

function anomalyFromStatus(status, source) {
  return {
    sourceId: status.sourceId,
    universityId: source.universityId,
    sourceUrl: source.url,
    reason: `source-${status.health}`,
    detectedAt: status.checkedAt,
    monitorMode: source.monitorMode,
    missingRequiredText: status.missingRequiredText,
    acceptedContentHash: status.contentHash,
    attemptObservedContentHash: status.attemptObservedContentHash,
    retainedTrustedFacts: true,
  };
}

function markersIn(body) {
  return [...String(body ?? '').matchAll(markerPattern)].map((match) => match[1]);
}

export async function upsertSourceAnomalyIssues({ workspace, github, context }) {
  const auditPath = join(workspace, 'artifacts', 'source-audit.json');
  if (!existsSync(auditPath)) return { candidates: 0, created: 0, updated: 0 };

  const [audit, sources, mastersCourseDirectories] = await Promise.all([
    readJson(auditPath),
    readJson(join(workspace, 'src', 'data', 'sources.json')),
    readJson(join(workspace, 'src', 'data', 'masters-course-directories.json')),
  ]);
  const sourceById = indexSources([...sources, ...mastersCourseDirectories]);
  const payloadByKey = new Map();
  for (const status of Object.values(audit)) {
    if (!anomalousHealth.has(status.health)) continue;
    const source = sourceById.get(status.sourceId);
    if (!source) throw new TypeError(`unknown audit source id: ${status.sourceId}`);
    const payload = anomalyIssuePayload(anomalyFromStatus(status, source));
    payloadByKey.set(payload.key, payload);
  }
  if (payloadByKey.size === 0) return { candidates: 0, created: 0, updated: 0 };

  const openIssues = await github.paginate(github.rest.issues.listForRepo, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    state: 'open',
    per_page: 100,
  });
  const issueByMarker = new Map();
  for (const issue of openIssues) {
    if (issue.pull_request) continue;
    for (const key of markersIn(issue.body)) issueByMarker.set(key, issue);
  }

  let created = 0;
  let updated = 0;
  for (const payload of payloadByKey.values()) {
    const existing = issueByMarker.get(payload.key);
    if (existing) {
      const result = await github.rest.issues.update({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: existing.number,
        title: payload.title,
        body: payload.body,
      });
      issueByMarker.set(payload.key, result.data);
      updated += 1;
    } else {
      const result = await github.rest.issues.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        title: payload.title,
        body: payload.body,
      });
      issueByMarker.set(payload.key, result.data);
      created += 1;
    }
  }
  return { candidates: payloadByKey.size, created, updated };
}

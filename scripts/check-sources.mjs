import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSource } from './source-checker.mjs';

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function redirectDestination(status, source) {
  return status?.finalUrl && status.finalUrl !== source.url ? status.finalUrl : undefined;
}

function semanticState(status, source) {
  const state = {
    contentHash: status?.contentHash,
    observedContentHash: status?.observedContentHash,
    health: status?.health,
    redirectDestination: redirectDestination(status, source),
    consecutiveFailures: status?.consecutiveFailures ?? 0,
    missingRequiredText: status?.missingRequiredText,
  };
  if (source.monitorMode !== 'page-identity') state.lastSuccessfulAt = status?.lastSuccessfulAt;
  return state;
}

function hasSemanticChange(previous, attempt, source) {
  return JSON.stringify(semanticState(previous, source)) !== JSON.stringify(semanticState(attempt, source));
}

function persistedStatus(attempt) {
  const { attemptObservedContentHash: _attemptObservedContentHash, ...status } = attempt;
  return status;
}

async function writeJsonAtomically(path, value) {
  const candidatePath = `${path}.next`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(candidatePath, json(value), 'utf8');
  await rename(candidatePath, path);
}

export function flattenMastersScholarshipLinks(entries) {
  return entries.flatMap((entry) => entry.entryState === 'available' ? entry.links : []);
}

export function loadCheckTargets({
  chinaSources = [],
  mastersCourseDirectories = [],
  mastersScholarshipEntries = [],
}) {
  const targets = [
    ...chinaSources,
    ...mastersCourseDirectories,
    ...flattenMastersScholarshipLinks(mastersScholarshipEntries),
  ];
  const ids = new Set();
  for (const target of targets) {
    if (ids.has(target.id)) throw new TypeError(`duplicate check target id: ${target.id}`);
    ids.add(target.id);
    let url;
    try {
      url = new URL(target.url);
    } catch {
      throw new TypeError(`check target ${target.id} must use a valid HTTPS URL`);
    }
    if (url.protocol !== 'https:') {
      throw new TypeError(`check target ${target.id} must use a valid HTTPS URL`);
    }
  }
  return targets;
}

export async function runSourceChecks(options = {}) {
  const root = options.root ?? defaultRoot;
  const sourcesPath = options.sourcesPath ?? join(root, 'src', 'data', 'sources.json');
  const mastersCourseDirectoriesPath = options.mastersCourseDirectoriesPath
    ?? join(root, 'src', 'data', 'masters-course-directories.json');
  const mastersScholarshipEntriesPath = options.mastersScholarshipEntriesPath
    ?? join(root, 'src', 'data', 'masters-scholarship-entries.json');
  const statusPath = options.statusPath ?? join(root, 'src', 'data', 'status.json');
  const auditPath = options.auditPath ?? join(root, 'artifacts', 'source-audit.json');
  const sources = options.sources
    ? loadCheckTargets({
      chinaSources: options.sources,
      mastersCourseDirectories: [],
      mastersScholarshipEntries: [],
    })
    : loadCheckTargets({
      chinaSources: options.chinaSources ?? JSON.parse(await readFile(sourcesPath, 'utf8')),
      mastersCourseDirectories: options.mastersCourseDirectories
        ?? JSON.parse(await readFile(mastersCourseDirectoriesPath, 'utf8')),
      mastersScholarshipEntries: options.mastersScholarshipEntries
        ?? JSON.parse(await readFile(mastersScholarshipEntriesPath, 'utf8')),
    });
  const previous = options.previous ?? JSON.parse(await readFile(statusPath, 'utf8'));
  const fetchImpl = options.fetchImpl ?? fetch;
  const wait = options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const minimumGapMs = options.minimumGapMs ?? 600;
  const attempts = {};
  const next = {};

  for (const [index, source] of sources.entries()) {
    if (index > 0) await wait(minimumGapMs);
    const now = typeof options.now === 'function' ? options.now() : (options.now ?? new Date());
    const attempt = await checkSource(source, fetchImpl, previous[source.id], now);
    attempts[source.id] = attempt;
    const candidate = persistedStatus(attempt);
    next[source.id] = hasSemanticChange(previous[source.id], candidate, source)
      ? candidate
      : previous[source.id];
  }

  await writeJsonAtomically(auditPath, attempts);
  if (JSON.stringify(next) !== JSON.stringify(previous)) {
    await writeJsonAtomically(statusPath, next);
  }
  return { status: next, attempts, statusChanged: JSON.stringify(next) !== JSON.stringify(previous) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runSourceChecks();
  console.log(`Checked ${Object.keys(result.attempts).length} official source(s).`);
}

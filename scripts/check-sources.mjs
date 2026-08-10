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
  return {
    contentHash: status?.contentHash,
    observedContentHash: status?.observedContentHash,
    health: status?.health,
    redirectDestination: redirectDestination(status, source),
    consecutiveFailures: status?.consecutiveFailures ?? 0,
    lastSuccessfulAt: status?.lastSuccessfulAt,
  };
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

export async function runSourceChecks(options = {}) {
  const root = options.root ?? defaultRoot;
  const sourcesPath = options.sourcesPath ?? join(root, 'src', 'data', 'sources.json');
  const statusPath = options.statusPath ?? join(root, 'src', 'data', 'status.json');
  const auditPath = options.auditPath ?? join(root, 'artifacts', 'source-audit.json');
  const sources = options.sources ?? JSON.parse(await readFile(sourcesPath, 'utf8'));
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

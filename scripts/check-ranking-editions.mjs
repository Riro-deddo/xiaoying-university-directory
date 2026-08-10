import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectRankingEditions } from './ranking-edition-monitor.mjs';

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

async function writeJsonAtomically(path, value) {
  const candidatePath = `${path}.next`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(candidatePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(candidatePath, path);
}

export async function runRankingEditionCheck(options = {}) {
  const root = options.root ?? defaultRoot;
  const rankingsPath = options.rankingsPath ?? join(root, 'src', 'data', 'rankings.json');
  const auditPath = options.auditPath ?? join(root, 'artifacts', 'ranking-edition-audit.json');
  const rankings = options.rankings ?? JSON.parse(await readFile(rankingsPath, 'utf8'));
  const checkedAt = options.checkedAt ?? new Date().toISOString();
  const audit = await inspectRankingEditions({
    releases: rankings.releases,
    fetchImpl: options.fetchImpl ?? fetch,
    checkedAt,
  });

  await writeJsonAtomically(auditPath, audit);
  return audit;
}

function summary(audit) {
  const counts = { current: 0, 'new-edition': 0, unverified: 0, unavailable: 0 };
  for (const result of audit.results) counts[result.status] += 1;
  return `Checked ${audit.results.length} official ranking release(s): ${Object.entries(counts)
    .map(([status, count]) => `${status}=${count}`)
    .join(', ')}.`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const audit = await runRankingEditionCheck();
  console.log(summary(audit));
  if (audit.results.some((result) => result.status === 'new-edition')) process.exitCode = 1;
}

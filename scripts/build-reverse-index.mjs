import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function positiveEvidenceState(fact) {
  return fact.scope === 'university' ? 'official-match' : 'faculty-match';
}

export function buildReverseIndex({ institutions, requirements, sources, statuses }) {
  const institutionIds = new Set(institutions.map((institution) => institution.id));
  const sourcesById = new Map(sources.map((source) => [source.id, source]));

  return requirements.map((fact) => {
    const source = sourcesById.get(fact.sourceId);
    if (!institutionIds.has(fact.institutionId)) {
      throw new Error(`Reverse index fact references unknown institution: ${fact.institutionId}`);
    }
    if (!source || source.universityId !== fact.universityId || source.scope !== fact.scope) {
      throw new Error(`Reverse index fact is not traceable to its official source: ${fact.id}`);
    }

    const entry = {
      institutionId: fact.institutionId,
      institutionOfficial: fact.institutionOfficial,
      universityId: fact.universityId,
      evidenceState: positiveEvidenceState(fact),
      tierOfficial: fact.tierOfficial,
      scopeZh: fact.scopeZh,
      sourceId: fact.sourceId,
      lastSuccessfulAt: statuses[fact.sourceId]?.lastSuccessfulAt ?? fact.extractedAt,
    };
    if (fact.scoreOfficial) entry.scoreOfficial = fact.scoreOfficial;
    if (fact.cycle) entry.cycle = fact.cycle;
    return entry;
  }).sort((left, right) =>
    left.institutionId.localeCompare(right.institutionId) ||
    left.universityId.localeCompare(right.universityId) ||
    left.sourceId.localeCompare(right.sourceId),
  );
}

export async function writeJsonAtomically(target, value) {
  await mkdir(dirname(target), { recursive: true });
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  const current = await readFile(target, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (current === serialized) return false;

  const temporary = join(dirname(target), `.${basename(target)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, serialized, 'utf8');
    await rename(temporary, target);
    return true;
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function writeReverseIndex() {
  const dataPath = (...parts) => join(root, 'src', 'data', ...parts);
  const [institutions, requirements, sources, statuses] = await Promise.all([
    readJson(dataPath('institutions.json')),
    readJson(dataPath('generated', 'requirements.json')),
    readJson(dataPath('sources.json')),
    readJson(dataPath('status.json')),
  ]);
  const index = buildReverseIndex({ institutions, requirements, sources, statuses });
  const target = dataPath('generated', 'reverse-index.json');
  await writeJsonAtomically(target, index);
  return index;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const index = await writeReverseIndex();
  console.log(`Built ${index.length} reverse index entries.`);
}

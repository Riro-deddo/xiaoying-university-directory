import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildReverseIndex } from './build-reverse-index.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function immutableProjection(index) {
  return index.map(({ lastSuccessfulAt: _lastSuccessfulAt, ...facts }) => facts);
}

export function assertReverseIndexFactsMatch(tracked, expected) {
  const trackedFacts = immutableProjection(tracked);
  const expectedFacts = immutableProjection(expected);
  if (JSON.stringify(trackedFacts) !== JSON.stringify(expectedFacts)) {
    throw new Error('Tracked reverse index does not match immutable reverse-index facts');
  }
}

async function readJson(...parts) {
  return JSON.parse(await readFile(join(root, 'src', 'data', ...parts), 'utf8'));
}

export async function checkReverseIndexConsistency() {
  const [tracked, institutions, requirements, sources, statuses] = await Promise.all([
    readJson('generated', 'reverse-index.json'),
    readJson('institutions.json'),
    readJson('generated', 'requirements.json'),
    readJson('sources.json'),
    readJson('status.json'),
  ]);
  const expected = buildReverseIndex({ institutions, requirements, sources, statuses });
  assertReverseIndexFactsMatch(tracked, expected);
  return expected.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const count = await checkReverseIndexConsistency();
  console.log(`Verified ${count} immutable reverse-index entries.`);
}

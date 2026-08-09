import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import requirements from '../src/data/generated/requirements.json';
import institutions from '../src/data/institutions.json';
import sources from '../src/data/sources.json';
import statuses from '../src/data/status.json';
import { buildReverseIndex, writeJsonAtomically } from '../scripts/build-reverse-index.mjs';

const root = process.cwd();
const indexPath = resolve(root, 'src/data/generated/reverse-index.json');

describe('build-reverse-index', () => {
  it('indexes every confirmed public-list source', () => {
    const sourceIds = new Set(requirements.map((fact) => fact.sourceId));
    expect(sourceIds).toEqual(new Set([
      'cambridge-china', 'warwick-china', 'bristol-china', 'glasgow-china',
      'nottingham-china', 'sheffield-china', 'southampton-china', 'ucl-china', 'edinburgh-china',
    ]));
  });

  it('produces identical JSON when run twice against unchanged source data', () => {
    execFileSync(process.execPath, ['scripts/build-reverse-index.mjs'], { cwd: root, stdio: 'pipe' });
    const first = readFileSync(indexPath, 'utf8');
    execFileSync(process.execPath, ['scripts/build-reverse-index.mjs'], { cwd: root, stdio: 'pipe' });
    expect(readFileSync(indexPath, 'utf8')).toBe(first);
  });

  it('does not rewrite unchanged generated JSON while other readers load it', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'xiaoying-atomic-json-'));
    const target = join(directory, 'reverse-index.json');
    const next = Array.from({ length: 40_000 }, (_, index) => ({ index, value: `record-${index}` }));
    await writeFile(target, `${JSON.stringify(next, null, 2)}\n`, 'utf8');

    try {
      let complete = false;
      const write = writeJsonAtomically(target, next).finally(() => { complete = true; });
      while (!complete) JSON.parse(await readFile(target, 'utf8'));
      expect(await write).toBe(false);
      expect(JSON.parse(await readFile(target, 'utf8'))).toHaveLength(40_000);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('does not create Chinese institution evidence for link-only specialist sources', () => {
    const index = buildReverseIndex({ institutions, requirements, sources, statuses });
    const newUniversityIds = new Set([
      'royal-college-of-art',
      'royal-veterinary-college',
      'royal-college-of-music',
      'institute-of-cancer-research-london',
      'liverpool-school-of-tropical-medicine',
    ]);

    expect(index.some((entry) => newUniversityIds.has(entry.universityId))).toBe(false);
  });
});

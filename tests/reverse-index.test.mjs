import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import requirements from '../src/data/generated/requirements.json';

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
});

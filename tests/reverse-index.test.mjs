import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const indexPath = resolve(root, 'src/data/generated/reverse-index.json');

describe('build-reverse-index', () => {
  it('produces identical JSON when run twice against unchanged source data', () => {
    execFileSync(process.execPath, ['scripts/build-reverse-index.mjs'], { cwd: root, stdio: 'pipe' });
    const first = readFileSync(indexPath, 'utf8');
    execFileSync(process.execPath, ['scripts/build-reverse-index.mjs'], { cwd: root, stdio: 'pipe' });
    expect(readFileSync(indexPath, 'utf8')).toBe(first);
  });
});

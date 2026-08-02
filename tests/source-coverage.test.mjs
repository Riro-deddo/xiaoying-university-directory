import { describe, expect, it } from 'vitest';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import cohort from '../src/data/qs-2027-top-200-uk.json';
import universities from '../src/data/universities.json';
import sources from '../src/data/sources.json';
import { evaluateCoverage } from '../scripts/report-source-coverage.mjs';

describe('source coverage report', () => {
  it('accepts the complete public catalog', () => {
    expect(evaluateCoverage({ cohort, universities, sources }).failures).toEqual([]);
  });

  it.each([
    ['missing university', { universities: universities.slice(1) }],
    ['missing source', { sources: sources.slice(1) }],
    ['duplicate source ID', { sources: [...sources, sources[0]] }],
    ['unregistered source domain', { sources: [{ ...sources[0], url: 'https://untrusted.example/china' }, ...sources.slice(1)] }],
    ['orphan source', { sources: [...sources, { ...sources[0], id: 'orphan-source', universityId: 'not-in-cohort' }] }],
    ['unreferenced source', { sources: [...sources, { ...sources[0], id: 'unreferenced-source' }] }],
  ])('reports %s as an integrity failure', (_label, override) => {
    const result = evaluateCoverage({ cohort, universities, sources, ...override });
    expect(result.failures.length).toBeGreaterThan(0);
  });

  it.each([
    ['missing university', { universities: universities.slice(1) }],
    ['missing source', { sources: sources.slice(1) }],
    ['duplicate source ID', { sources: [...sources, sources[0]] }],
    ['unregistered source domain', { sources: [{ ...sources[0], url: 'https://untrusted.example/china' }, ...sources.slice(1)] }],
    ['orphan source', { sources: [...sources, { ...sources[0], id: 'orphan-source', universityId: 'not-in-cohort' }] }],
  ])('exits nonzero when a data-root contains %s', async (_label, override) => {
    const root = await mkdtemp(join(tmpdir(), 'source-coverage-'));
    const dataRoot = join(root, 'data');
    await cp(resolve('src/data'), dataRoot, { recursive: true });
    await Promise.all(Object.entries(override).map(([name, value]) => writeFile(join(dataRoot, `${name}.json`), `${JSON.stringify(value)}\n`)));
    const result = spawnSync(process.execPath, ['scripts/report-source-coverage.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, SOURCE_COVERAGE_DATA_ROOT: dataRoot },
      encoding: 'utf8',
    });
    await rm(root, { recursive: true, force: true });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Coverage failure');
  });
});

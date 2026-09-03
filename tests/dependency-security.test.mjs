import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pnpmCli = process.env.npm_execpath;
const minimumSafeVersions = {
  'fast-uri': '3.1.6',
  nanoid: '3.3.18',
};

function compareVersions(left, right) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);

  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
}

function collectTargetVersions(node, versions) {
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, dependency] of Object.entries(node[section] ?? {})) {
      if (name in minimumSafeVersions && typeof dependency.version === 'string') {
        versions.get(name).add(dependency.version);
      }
      collectTargetVersions(dependency, versions);
    }
  }
}

describe('installed dependency security floor', () => {
  it('contains only patched fast-uri and nanoid releases', () => {
    expect(pnpmCli, 'pnpm should expose its CLI path to the test process').toBeTruthy();
    const dependencyTrees = JSON.parse(
      execFileSync(
        process.execPath,
        [pnpmCli, 'list', ...Object.keys(minimumSafeVersions), '--depth', 'Infinity', '--json'],
        { cwd: projectRoot, encoding: 'utf8' },
      ),
    );
    const versions = new Map(
      Object.keys(minimumSafeVersions).map((name) => [name, new Set()]),
    );

    for (const tree of dependencyTrees) collectTargetVersions(tree, versions);

    for (const [name, minimumVersion] of Object.entries(minimumSafeVersions)) {
      const installedVersions = [...versions.get(name)];
      expect(installedVersions, `${name} should be present in the installed graph`).not.toEqual([]);
      expect(
        installedVersions.every((version) => compareVersions(version, minimumVersion) >= 0),
        `${name} versions ${installedVersions.join(', ')} should be >= ${minimumVersion}`,
      ).toBe(true);
    }
  });
});

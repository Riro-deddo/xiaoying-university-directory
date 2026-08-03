import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dailyWorkflow = readFileSync('.github/workflows/daily-check.yml', 'utf8').replace(/\r\n/g, '\n');
const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const deployWorkflow = readFileSync('.github/workflows/deploy.yml', 'utf8');

const officialWorkflowText = [ciWorkflow, dailyWorkflow, deployWorkflow].join('\n');

const approvedOfficialActionPins = [
  ['actions/checkout', '3d3c42e5aac5ba805825da76410c181273ba90b1', 'v7.0.1', 3],
  ['actions/setup-node', '820762786026740c76f36085b0efc47a31fe5020', 'v7.0.0', 3],
  ['actions/github-script', '3a2844b7e9c422d3c10d287c895573f7108da1b3', 'v9.0.0', 1],
  ['actions/configure-pages', '45bfe0192ca1faeb007ade9deae92b16b8254a0d', 'v6.0.0', 1],
  ['actions/upload-pages-artifact', 'fc324d3547104276b827a68afc52ff2a11cc49c9', 'v5.0.0', 1],
  ['actions/deploy-pages', 'cd2ce8fcbc39b97be8ca5fce6e763baed58fa128', 'v5.0.0', 1],
];

describe('official GitHub Action pins', () => {
  it('uses only the approved Node 24-compatible official releases', () => {
    const officialUses = [...officialWorkflowText.matchAll(/uses:\s+(actions\/[^@\s]+)@([0-9a-f]{40})\s+#\s+(\S+)/g)];

    expect(officialUses).toHaveLength(10);
    for (const [name, sha, version, count] of approvedOfficialActionPins) {
      const matches = officialUses.filter((match) => match[1] === name && match[2] === sha && match[3] === version);
      expect(matches, `${name}@${sha} # ${version}`).toHaveLength(count);
    }
    expect(officialWorkflowText.match(/node-version:\s*22/g)).toHaveLength(3);
  });
});

describe('guarded daily source workflow', () => {
  it('grants issue write permission only to the daily check', () => {
    expect(dailyWorkflow).toContain('issues: write');
    expect(ciWorkflow).not.toContain('issues: write');
    expect(deployWorkflow).not.toContain('issues: write');
  });

  it('checks links, syncs safely, rebuilds the index, and verifies before committing', () => {
    const orderedSteps = [
      'lycheeverse/lychee-action',
      'pnpm sync:sources',
      'pnpm build:index',
      'pnpm test:run',
      '- run: pnpm build\n',
      'git commit',
    ];
    const positions = orderedSteps.map((step) => dailyWorkflow.indexOf(step));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('commits only status and accepted generated datasets', () => {
    expect(dailyWorkflow).toContain('src/data/status.json');
    expect(dailyWorkflow).toContain('src/data/institutions.json');
    expect(dailyWorkflow).toContain('src/data/generated/requirements.json');
    expect(dailyWorkflow).toContain('src/data/generated/reverse-index.json');
    expect(dailyWorkflow).not.toMatch(/git add\s+\.|git add\s+-A/);
  });

  it('commits the institution registry whenever guarded sync can change it', () => {
    const diffGuard = dailyWorkflow.match(/if git diff --quiet -- ([^;]+);/)?.[1] ?? '';
    const gitAdd = dailyWorkflow.match(/^\s*git add (.+)$/m)?.[1] ?? '';

    expect(diffGuard).toContain('src/data/institutions.json');
    expect(gitAdd).toContain('src/data/institutions.json');
  });

  it('keeps CI read-only and checks reverse-index consistency', () => {
    expect(ciWorkflow).toContain('contents: read');
    expect(ciWorkflow).toContain('pnpm build:index');
    expect(ciWorkflow).toContain('git diff --exit-code -- src/data/generated/reverse-index.json');
  });

  it('dispatches CI for the exact bot-authored revision after the guarded push', () => {
    expect(dailyWorkflow).toContain('event_type=guarded-source-update');
    expect(dailyWorkflow.indexOf('git push')).toBeLessThan(dailyWorkflow.indexOf('event_type=guarded-source-update'));
    expect(ciWorkflow).toContain('repository_dispatch:');
    expect(ciWorkflow).toContain('types: [guarded-source-update]');
    expect(ciWorkflow).toContain('ref: ${{ github.event.client_payload.sha || github.sha }}');
  });
});

describe('Pages deployment workflow', () => {
  it('accepts CI completion events without a branch name from repository dispatch', () => {
    const workflowRunTrigger = deployWorkflow.match(/workflow_run:\r?\n([\s\S]*?)permissions:/)?.[1] ?? '';

    expect(workflowRunTrigger).toContain('workflows: [CI]');
    expect(workflowRunTrigger).not.toMatch(/^\s*branches:/m);
  });

  it('checks out the exact revision that passed CI', () => {
    expect(deployWorkflow).toContain('ref: ${{ github.event.workflow_run.head_sha }}');
  });

  it('does not let an older completed run replace the current site', () => {
    expect(deployWorkflow).toContain('github.event.workflow_run.head_sha == github.sha');
  });
});

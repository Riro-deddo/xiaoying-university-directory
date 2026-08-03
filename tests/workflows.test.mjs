import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dailyWorkflow = readFileSync('.github/workflows/daily-check.yml', 'utf8').replace(/\r\n/g, '\n');
const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const deployWorkflow = readFileSync('.github/workflows/deploy.yml', 'utf8');

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

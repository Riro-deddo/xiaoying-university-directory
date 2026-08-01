import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deployWorkflow = readFileSync('.github/workflows/deploy.yml', 'utf8');

describe('Pages deployment workflow', () => {
  it('checks out the exact revision that passed CI', () => {
    expect(deployWorkflow).toContain('ref: ${{ github.event.workflow_run.head_sha }}');
  });

  it('does not let an older completed run replace the current site', () => {
    expect(deployWorkflow).toContain('github.event.workflow_run.head_sha == github.sha');
  });
});

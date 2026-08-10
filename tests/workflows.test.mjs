import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dailyWorkflow = readFileSync('.github/workflows/daily-check.yml', 'utf8').replace(/\r\n/g, '\n');
const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const deployWorkflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
const rankingEditionWorkflow = readFileSync('.github/workflows/ranking-edition-check.yml', 'utf8').replace(/\r\n/g, '\n');

const officialWorkflowText = [ciWorkflow, dailyWorkflow, deployWorkflow, rankingEditionWorkflow].join('\n');
const rankingSteps = (rankingEditionWorkflow.split('\n    steps:\n')[1] ?? '')
  .split(/(?=^      - )/mu)
  .filter((step) => step.startsWith('      - '));
const dailySteps = (dailyWorkflow.split('\n    steps:\n')[1] ?? '')
  .split(/(?=^      - )/mu)
  .filter((step) => step.startsWith('      - '));

function dailyStepContaining(fragment) {
  return dailySteps.find((step) => step.includes(fragment));
}

function workflowRunScript(step) {
  const runBlock = step?.match(/^        run: \|\n([\s\S]*)$/mu)?.[1] ?? '';
  return runBlock.replace(/^          /gmu, '').trim();
}

function workflowGithubScript(step) {
  const scriptBlock = step?.match(/^          script: \|\n([\s\S]*)$/mu)?.[1] ?? '';
  return scriptBlock.replace(/^            /gmu, '').trim();
}

const rankingIssueScript = workflowGithubScript(
  rankingSteps.find((step) => step.includes('Create or update one Issue per new ranking edition')),
);

const approvedOfficialActionPins = [
  ['actions/checkout', '3d3c42e5aac5ba805825da76410c181273ba90b1', 'v7.0.1', 4],
  ['actions/setup-node', '820762786026740c76f36085b0efc47a31fe5020', 'v7.0.0', 4],
  ['actions/github-script', '3a2844b7e9c422d3c10d287c895573f7108da1b3', 'v9.0.0', 2],
  ['actions/configure-pages', '45bfe0192ca1faeb007ade9deae92b16b8254a0d', 'v6.0.0', 2],
  ['actions/upload-pages-artifact', 'fc324d3547104276b827a68afc52ff2a11cc49c9', 'v5.0.0', 2],
  ['actions/deploy-pages', 'cd2ce8fcbc39b97be8ca5fce6e763baed58fa128', 'v5.0.0', 2],
];

describe('official GitHub Action pins', () => {
  it('uses only the approved Node 24-compatible official releases', () => {
    const officialUses = [...officialWorkflowText.matchAll(/uses:\s+(actions\/[^@\s]+)@([0-9a-f]{40})\s+#\s+(\S+)/g)];

    expect(officialUses).toHaveLength(16);
    for (const [name, sha, version, count] of approvedOfficialActionPins) {
      const matches = officialUses.filter((match) => match[1] === name && match[2] === sha && match[3] === version);
      expect(matches, `${name}@${sha} # ${version}`).toHaveLength(count);
    }
    expect(officialWorkflowText.match(/node-version:\s*22/g)).toHaveLength(4);
  });
});

describe('weekly ranking edition review workflow', () => {
  it('serializes schedule and manual runs in one stable concurrency group', () => {
    const concurrencyBlock = rankingEditionWorkflow.match(/^concurrency:\n([\s\S]*?)^jobs:/mu)?.[1] ?? '';

    expect(concurrencyBlock).toBe([
      '  group: ranking-edition-review-check',
      '  cancel-in-progress: false',
      '',
    ].join('\n'));
  });

  it('runs weekly and manually with only the permissions needed to upsert Issues', () => {
    expect(rankingEditionWorkflow).toContain("cron: '41 4 * * 1'");
    expect(rankingEditionWorkflow).toContain('workflow_dispatch:');
    expect(rankingEditionWorkflow).toMatch(/^permissions: \{\}$/mu);
    expect(rankingEditionWorkflow).toMatch(/^      contents: read$/mu);
    expect(rankingEditionWorkflow).toMatch(/^      issues: write$/mu);
    expect(rankingEditionWorkflow).not.toContain('contents: write');
    expect(rankingEditionWorkflow).not.toContain('pages: write');
    expect(rankingEditionWorkflow).not.toContain('id-token: write');
  });

  it('monitors the fixed audit and upserts only unambiguous newer editions by stable marker', () => {
    expect(rankingEditionWorkflow).toContain('pnpm monitor:ranking-editions');
    expect(rankingEditionWorkflow).toContain('artifacts/ranking-edition-audit.json');
    expect(rankingEditionWorkflow).toContain("status === 'new-edition'");
    expect(rankingEditionWorkflow).toContain('render-ranking-edition-issue.mjs');
    expect(rankingEditionWorkflow).toContain('<!-- ${payload.key} -->');
    expect(rankingEditionWorkflow).toContain('github.rest.issues.listForRepo');
    expect(rankingEditionWorkflow).toContain('github.rest.issues.update');
    expect(rankingEditionWorkflow).toContain('github.rest.issues.create');
  });

  it('deduplicates audit candidates by payload key and keeps its marker index current', () => {
    expect(rankingIssueScript).toContain('const payloadByKey = new Map();');
    expect(rankingIssueScript).toContain('payloadByKey.set(payload.key, payload);');
    expect(rankingIssueScript).toContain('const issueByMarker = new Map(');
    expect(rankingIssueScript).toContain('issueByMarker.set(marker, updated);');
    expect(rankingIssueScript).toContain('issueByMarker.set(marker, created);');
  });

  it('creates only one Issue when the audit repeats a provider and edition', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xiaoying-ranking-workflow-'));
    const createCalls = [];
    const updateCalls = [];
    const duplicate = {
      provider: 'qs',
      reviewedEdition: 2027,
      detectedEdition: 2028,
      status: 'new-edition',
      checkedAt: '2026-08-10T12:34:56.000Z',
    };

    try {
      await mkdir(join(root, 'artifacts'), { recursive: true });
      await writeFile(join(root, 'artifacts', 'ranking-edition-audit.json'), JSON.stringify({
        checkedAt: duplicate.checkedAt,
        results: [
          { ...duplicate, sourceUrl: 'https://www.topuniversities.com/first' },
          { ...duplicate, sourceUrl: 'https://www.topuniversities.com/second' },
          { ...duplicate, status: 'current', sourceUrl: 'https://www.topuniversities.com/current' },
        ],
      }), 'utf8');

      const github = {
        paginate: async () => [],
        rest: {
          issues: {
            listForRepo() {},
            create: async (input) => {
              createCalls.push(input);
              return { data: { number: 101, title: input.title, body: input.body } };
            },
            update: async (input) => {
              updateCalls.push(input);
              return { data: { number: input.issue_number, title: input.title, body: input.body } };
            },
          },
        },
      };
      const executableScript = rankingIssueScript.replace(
        "const { rankingEditionIssuePayload } = await import(rendererPath);",
        'const { rankingEditionIssuePayload } = renderer;',
      );
      const execute = Object.getPrototypeOf(async function () {}).constructor(
        'require',
        'process',
        'github',
        'context',
        'renderer',
        executableScript,
      );

      await execute(
        createRequire(import.meta.url),
        { env: { GITHUB_WORKSPACE: root } },
        github,
        { repo: { owner: 'example', repo: 'directory' } },
        await import('../scripts/render-ranking-edition-issue.mjs'),
      );

      expect(createCalls).toHaveLength(1);
      expect(createCalls[0].body).toContain('https://www.topuniversities.com/second');
      expect(updateCalls).toHaveLength(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('has no ranking-data, repository, Pages, or deployment mutation path', () => {
    expect(rankingEditionWorkflow).not.toContain('src/data/rankings.json');
    expect(rankingEditionWorkflow).not.toMatch(/\bgit\s+(?:add|commit|push)\b/u);
    expect(rankingEditionWorkflow).not.toContain('upload-pages-artifact');
    expect(rankingEditionWorkflow).not.toContain('deploy-pages');
    expect(rankingEditionWorkflow).not.toMatch(/\bdeploy\b/iu);
  });
});

describe('guarded daily source workflow', () => {
  it('grants issue write permission only to the daily check', () => {
    expect(dailyWorkflow).toContain('issues: write');
    expect(ciWorkflow).not.toContain('issues: write');
    expect(deployWorkflow).not.toContain('issues: write');
  });

  it('checks links and source review state, then verifies before committing', () => {
    const orderedSteps = [
      'lycheeverse/lychee-action',
      'pnpm check:sources',
      'pnpm build:public',
      'pnpm test:run',
      '- run: pnpm build\n',
      'git commit',
    ];
    const positions = orderedSteps.map((fragment) => dailySteps.findIndex((step) => step.includes(fragment)));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('runs the exact status-only commit contract after semantic review state changes', () => {
    const commitScript = workflowRunScript(dailyStepContaining('git commit'));
    expect(commitScript).toBe([
      'if git diff --quiet -- src/data/status.json; then exit 0; fi',
      'git config user.name "github-actions[bot]"',
      'git config user.email "41898282+github-actions[bot]@users.noreply.github.com"',
      'git add src/data/status.json',
      'git commit -m "chore: refresh official-source review status"',
      'git push',
      'COMMITTED_SHA=$(git rev-parse HEAD)',
      'gh api --method POST "repos/${GITHUB_REPOSITORY}/dispatches" -f event_type=guarded-source-update -f "client_payload[sha]=$COMMITTED_SHA"',
    ].join('\n'));
  });

  it('never accepts source facts or touches generated and annual-ranking datasets', () => {
    expect(dailyWorkflow).not.toContain('pnpm sync:sources');
    expect(dailyWorkflow).not.toContain('src/data/institutions.json');
    expect(dailyWorkflow).not.toContain('src/data/generated/requirements.json');
    expect(dailyWorkflow).not.toContain('src/data/generated/reverse-index.json');
    expect(dailyWorkflow).not.toContain('src/data/rankings.json');
    expect(dailyWorkflow).not.toMatch(/git add\s+\.|git add\s+-A/);
  });

  it('renders issue candidates from the complete daily audit artifact', () => {
    const issueStep = dailyStepContaining('Create or update one Issue per source anomaly');
    expect(issueStep).toContain('artifacts/source-audit.json');
    expect(issueStep).toContain("Object.values(audit)");
    expect(issueStep).toContain("['changed', 'temporary-error', 'unavailable'].includes(status.health)");
    expect(issueStep).not.toContain('source-anomalies.json');
  });

  it('passes accepted and observed content fingerprints to daily Issue candidates', () => {
    const issueStep = dailyStepContaining('Create or update one Issue per source anomaly');

    expect(issueStep).toContain('acceptedContentHash: status.contentHash');
    expect(issueStep).toContain('observedContentHash: status.observedContentHash');
  });

  it('keeps CI read-only and checks reverse-index consistency', () => {
    expect(ciWorkflow).toContain('contents: read');
    const orderedSteps = [
      'pnpm build:index',
      'git diff --exit-code -- src/data/generated/reverse-index.json',
      'pnpm build:public',
      'pnpm test:run',
    ];
    const positions = orderedSteps.map((fragment) => ciWorkflow.indexOf(fragment));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('dispatches CI for the exact bot-authored revision after the guarded push', () => {
    expect(dailyWorkflow).toContain('event_type=guarded-source-update');
    expect(dailyWorkflow.indexOf('git push')).toBeLessThan(dailyWorkflow.indexOf('event_type=guarded-source-update'));
    expect(ciWorkflow).toContain('repository_dispatch:');
    expect(ciWorkflow).toContain('types: [guarded-source-update]');
    expect(ciWorkflow).toContain('ref: ${{ github.event.client_payload.sha || github.sha }}');
  });

  it('publishes the verified daily build without relying on a downstream bot-triggered workflow', () => {
    expect(dailyWorkflow).toContain('pages: write');
    expect(dailyWorkflow).toContain('id-token: write');

    const buildPosition = dailyWorkflow.indexOf('- run: pnpm build\n');
    const commitPosition = dailyWorkflow.indexOf('git commit');
    const uploadPosition = dailyWorkflow.indexOf('actions/upload-pages-artifact');
    expect([buildPosition, commitPosition, uploadPosition].every((position) => position >= 0)).toBe(true);
    expect(buildPosition).toBeLessThan(commitPosition);
    expect(commitPosition).toBeLessThan(uploadPosition);

    const deployJob = dailyWorkflow.match(/^  deploy:\n([\s\S]*)$/m)?.[1] ?? '';
    expect(deployJob).toContain('needs: check');
    expect(deployJob).toContain('name: github-pages');
    expect(deployJob).toContain('actions/deploy-pages');
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

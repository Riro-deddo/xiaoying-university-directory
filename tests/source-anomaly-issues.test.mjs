import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { upsertSourceAnomalyIssues } from '../scripts/upsert-source-anomaly-issues.mjs';

async function writeWorkspace(root, audit) {
  await mkdir(join(root, 'artifacts'), { recursive: true });
  await mkdir(join(root, 'src', 'data'), { recursive: true });
  await writeFile(join(root, 'artifacts', 'source-audit.json'), JSON.stringify(audit), 'utf8');
  await writeFile(join(root, 'src', 'data', 'sources.json'), JSON.stringify([{
    id: 'china-one',
    universityId: 'university-one',
    url: 'https://one.example/china',
  }]), 'utf8');
  await writeFile(join(root, 'src', 'data', 'masters-course-directories.json'), JSON.stringify([{
    id: 'masters-two',
    universityId: 'university-two',
    url: 'https://two.example/masters',
    monitorMode: 'page-identity',
    requiredText: ['Postgraduate courses'],
  }]), 'utf8');
}

function githubDouble(openIssues = []) {
  const createCalls = [];
  const updateCalls = [];
  return {
    createCalls,
    updateCalls,
    github: {
      paginate: async () => openIssues,
      rest: {
        issues: {
          listForRepo() {},
          create: async (input) => {
            createCalls.push(input);
            return { data: { number: 101, ...input } };
          },
          update: async (input) => {
            updateCalls.push(input);
            return { data: { ...input } };
          },
        },
      },
    },
  };
}

const context = { repo: { owner: 'example', repo: 'directory' } };
const mastersCandidate = {
  sourceId: 'masters-two',
  health: 'changed',
  checkedAt: '2026-08-11T03:17:00.000Z',
  missingRequiredText: ['Postgraduate courses'],
};

describe('daily source anomaly Issue upsert', () => {
  it('resolves a masters anomaly from the second registry and creates one stable-marker Issue', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xiaoying-source-issue-create-'));
    const client = githubDouble();
    try {
      await writeWorkspace(root, {
        'duplicate-a': mastersCandidate,
        'duplicate-b': { ...mastersCandidate },
      });

      await upsertSourceAnomalyIssues({ workspace: root, github: client.github, context });

      expect(client.createCalls).toHaveLength(1);
      expect(client.updateCalls).toHaveLength(0);
      expect(client.createCalls[0].title).toBe('[课程入口异常] masters-two');
      expect(client.createCalls[0].body.split('\n')).toContain('<!-- source-anomaly:masters-two -->');
      expect(client.createCalls[0].body).toContain('硕士课程入口身份异常');
      expect(client.createCalls[0].body).toContain('Postgraduate courses');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('updates an existing marker once when the audit repeats the same source candidate', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xiaoying-source-issue-update-'));
    const client = githubDouble([{
      number: 42,
      body: 'Existing report\n<!-- source-anomaly:masters-two -->',
    }]);
    try {
      await writeWorkspace(root, {
        'duplicate-a': mastersCandidate,
        'duplicate-b': { ...mastersCandidate },
      });

      await upsertSourceAnomalyIssues({ workspace: root, github: client.github, context });

      expect(client.createCalls).toHaveLength(0);
      expect(client.updateCalls).toHaveLength(1);
      expect(client.updateCalls[0]).toMatchObject({
        issue_number: 42,
        title: '[课程入口异常] masters-two',
      });
      expect(client.updateCalls[0].body.split('\n')).toContain('<!-- source-anomaly:masters-two -->');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not update an Issue whose marker only shares the source prefix', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xiaoying-source-issue-marker-collision-'));
    const client = githubDouble([{
      number: 43,
      body: '<!-- source-anomaly:masters-two-extra -->',
    }]);
    try {
      await writeWorkspace(root, { candidate: mastersCandidate });

      await upsertSourceAnomalyIssues({ workspace: root, github: client.github, context });

      expect(client.createCalls).toHaveLength(1);
      expect(client.updateCalls).toHaveLength(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('keeps the existing China-source Issue rendering behavior', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xiaoying-source-issue-china-'));
    const client = githubDouble();
    try {
      await writeWorkspace(root, {
        'china-candidate': {
          sourceId: 'china-one',
          health: 'changed',
          checkedAt: '2026-08-11T03:17:00.000Z',
          contentHash: 'a'.repeat(64),
          attemptObservedContentHash: 'b'.repeat(64),
        },
      });

      await upsertSourceAnomalyIssues({ workspace: root, github: client.github, context });

      expect(client.createCalls).toHaveLength(1);
      expect(client.createCalls[0].title).toBe('[数据异常] china-one');
      expect(client.createCalls[0].body.split('\n')).toContain('<!-- source-anomaly:china-one -->');
      expect(client.createCalls[0].body).toContain('`' + 'a'.repeat(64) + '`');
      expect(client.createCalls[0].body).toContain('`' + 'b'.repeat(64) + '`');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

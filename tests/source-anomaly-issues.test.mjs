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
  await writeFile(join(root, 'src', 'data', 'masters-scholarship-entries.json'), JSON.stringify([
    {
      universityId: 'university-three',
      entryState: 'available',
      links: [
        {
          id: 'scholarships-three-directory',
          universityId: 'university-three',
          url: 'https://three.example/scholarships',
          monitorMode: 'page-identity',
          requiredText: ['Scholarships'],
        },
        {
          id: 'scholarships-three-search',
          universityId: 'university-three',
          url: 'https://three.example/scholarship-search',
          monitorMode: 'page-identity',
          requiredText: ['Scholarship Search'],
        },
      ],
    },
    { universityId: 'icr', entryState: 'no-public-entry', links: [] },
  ]), 'utf8');
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

  it('indexes each available grouped scholarship link and renders its scholarship Issue', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xiaoying-source-issue-scholarship-'));
    const client = githubDouble();
    try {
      await writeWorkspace(root, {
        candidate: {
          sourceId: 'scholarships-three-search',
          health: 'changed',
          checkedAt: '2026-08-31T03:17:00.000Z',
          missingRequiredText: ['Scholarship Search'],
        },
      });

      await upsertSourceAnomalyIssues({ workspace: root, github: client.github, context });

      expect(client.createCalls).toHaveLength(1);
      expect(client.createCalls[0].title).toBe('[奖学金入口异常] scholarships-three-search');
      expect(client.createCalls[0].body).toContain('硕士奖学金官网入口身份异常');
      expect(client.createCalls[0].body).toContain('不会自动替换正式入口');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not synthesize an Issue for a no-public-entry group', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xiaoying-source-issue-no-public-'));
    const client = githubDouble();
    try {
      await writeWorkspace(root, {});

      const result = await upsertSourceAnomalyIssues({ workspace: root, github: client.github, context });

      expect(result).toEqual({ candidates: 0, created: 0, updated: 0 });
      expect(client.createCalls).toHaveLength(0);
      expect(client.updateCalls).toHaveLength(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects a duplicate ID between a scholarship link and another registry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xiaoying-source-issue-duplicate-'));
    const client = githubDouble();
    try {
      await writeWorkspace(root, {});
      await writeFile(join(root, 'src', 'data', 'masters-scholarship-entries.json'), JSON.stringify([{
        universityId: 'university-three',
        entryState: 'available',
        links: [{
          id: 'china-one',
          universityId: 'university-three',
          url: 'https://three.example/scholarships',
          monitorMode: 'page-identity',
          requiredText: ['Scholarships'],
        }],
      }]), 'utf8');

      await expect(upsertSourceAnomalyIssues({ workspace: root, github: client.github, context }))
        .rejects.toThrow(/duplicate source id: china-one/u);
      expect(client.createCalls).toHaveLength(0);
      expect(client.updateCalls).toHaveLength(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

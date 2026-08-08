import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const acceptedRequirementsHash = '073161e41bae112ec5f0bfbaf37abef49c5126b3292fd7a167cefe4a5ddf2c0c';

describe('check-sources command', () => {
  it('writes every attempt to an audit artifact without persisting timestamp-only status changes', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'xiaoying-source-audit-'));
    const server = createServer((request, response) => {
      if (request.method === 'HEAD') {
        response.writeHead(405).end();
        return;
      }
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<html>official requirements</html>');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('test server did not expose a TCP address');
      const url = `http://127.0.0.1:${address.port}/china`;
      const scriptsDirectory = join(temporaryRoot, 'scripts');
      const dataDirectory = join(temporaryRoot, 'src', 'data');
      await mkdir(scriptsDirectory, { recursive: true });
      await mkdir(dataDirectory, { recursive: true });
      await copyFile('scripts/check-sources.mjs', join(scriptsDirectory, 'check-sources.mjs'));
      await copyFile('scripts/source-checker.mjs', join(scriptsDirectory, 'source-checker.mjs'));
      await copyFile('scripts/source-content-hash.mjs', join(scriptsDirectory, 'source-content-hash.mjs'));
      await writeFile(join(dataDirectory, 'sources.json'), `${JSON.stringify([{ id: 'source-1', url }], null, 2)}\n`);
      const previousStatus = {
        'source-1': {
          sourceId: 'source-1',
          health: 'ok',
          checkedAt: '2026-08-07T03:17:00.000Z',
          lastSuccessfulAt: '2026-08-07T03:17:00.000Z',
          httpStatus: 200,
          finalUrl: url,
          contentHash: acceptedRequirementsHash,
          consecutiveFailures: 0,
        },
      };
      const previousStatusText = `${JSON.stringify(previousStatus, null, 2)}\n`;
      const statusPath = join(dataDirectory, 'status.json');
      await writeFile(statusPath, previousStatusText);

      await execFileAsync(process.execPath, [join(scriptsDirectory, 'check-sources.mjs')]);

      const auditPath = join(temporaryRoot, 'artifacts', 'source-audit.json');
      expect(existsSync(auditPath)).toBe(true);
      const audit = JSON.parse(await readFile(auditPath, 'utf8'));
      expect(audit['source-1']).toMatchObject({
        sourceId: 'source-1',
        health: 'ok',
        contentHash: acceptedRequirementsHash,
        consecutiveFailures: 0,
      });
      expect(audit['source-1'].checkedAt).not.toBe(previousStatus['source-1'].checkedAt);
      expect(await readFile(statusPath, 'utf8')).toBe(previousStatusText);
    } finally {
      server.close();
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('does not rewrite tracked status when an observed-only 200 is followed by 304', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'xiaoying-source-observation-'));
    let respondNotModified = false;
    const server = createServer((request, response) => {
      if (respondNotModified) {
        response.writeHead(304).end();
        return;
      }
      if (request.method === 'HEAD') {
        response.writeHead(405).end();
        return;
      }
      response.writeHead(200, { 'content-type': 'text/html', etag: 'observed-etag' });
      response.end('<html>official requirements</html>');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('test server did not expose a TCP address');
      const url = `http://127.0.0.1:${address.port}/china`;
      const scriptsDirectory = join(temporaryRoot, 'scripts');
      const dataDirectory = join(temporaryRoot, 'src', 'data');
      await mkdir(scriptsDirectory, { recursive: true });
      await mkdir(dataDirectory, { recursive: true });
      await copyFile('scripts/check-sources.mjs', join(scriptsDirectory, 'check-sources.mjs'));
      await copyFile('scripts/source-checker.mjs', join(scriptsDirectory, 'source-checker.mjs'));
      await copyFile('scripts/source-content-hash.mjs', join(scriptsDirectory, 'source-content-hash.mjs'));
      await writeFile(join(dataDirectory, 'sources.json'), `${JSON.stringify([{ id: 'source-1', url }], null, 2)}\n`);
      const statusPath = join(dataDirectory, 'status.json');
      await writeFile(statusPath, `${JSON.stringify({
        'source-1': {
          sourceId: 'source-1',
          health: 'ok',
          checkedAt: '2026-08-07T03:17:00.000Z',
          finalUrl: url,
          consecutiveFailures: 0,
        },
      }, null, 2)}\n`);

      await execFileAsync(process.execPath, [join(scriptsDirectory, 'check-sources.mjs')]);
      const statusAfter200 = await readFile(statusPath, 'utf8');
      const observed = JSON.parse(statusAfter200)['source-1'];
      expect(observed).toMatchObject({
        health: 'ok',
        observedContentHash: acceptedRequirementsHash,
        etag: 'observed-etag',
        consecutiveFailures: 0,
      });

      respondNotModified = true;
      await execFileAsync(process.execPath, [join(scriptsDirectory, 'check-sources.mjs')]);

      expect(await readFile(statusPath, 'utf8')).toBe(statusAfter200);
    } finally {
      server.close();
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});

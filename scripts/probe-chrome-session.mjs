import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const alreadyRecovered = new Set([
  'www.durham.ac.uk',
  'www.qmul.ac.uk',
  'www.qub.ac.uk',
  'www.rvc.ac.uk',
]);
const blockMarkers = ['access denied', 'attention required', 'human verification', 'just a moment', 'request blocked'];

function scholarshipLinks(entries) {
  return entries.flatMap((entry) => entry.entryState === 'available' ? entry.links : []);
}

function unavailableTargets(targets, statuses) {
  const byHost = new Map();
  for (const target of targets) {
    const host = new URL(target.url).hostname;
    if (alreadyRecovered.has(host) || statuses[target.id]?.health !== 'unavailable' || byHost.has(host)) continue;
    byHost.set(host, target);
  }
  return [...byHost.entries()].map(([host, target]) => ({ host, target }));
}

function isBlocked(status, title, text) {
  if ([401, 403, 405, 406, 429].includes(status)) return true;
  const sample = `${title}\n${text}`.toLowerCase();
  return blockMarkers.some((marker) => sample.includes(marker));
}

async function visit(page, url) {
  let documentStatus;
  const listener = (response) => {
    if (response.request().resourceType() === 'document' && response.frame() === page.mainFrame()) {
      documentStatus = response.status();
    }
  };
  page.on('response', listener);
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35_000 });
    documentStatus ??= response?.status();
    await page.waitForTimeout(8_000);
    const [title, text] = await Promise.all([
      page.title().catch(() => ''),
      page.locator('body').innerText({ timeout: 5_000 }).catch(() => ''),
    ]);
    return {
      accessible: Boolean(documentStatus && documentStatus >= 200 && documentStatus < 400 && text.length > 100 && !isBlocked(documentStatus, title, text)),
      finalUrl: page.url(),
      status: documentStatus,
      textLength: text.length,
      title,
    };
  } catch (error) {
    return {
      accessible: false,
      finalUrl: page.url(),
      status: documentStatus,
      error: error instanceof Error ? error.message : 'unknown browser error',
    };
  } finally {
    page.off('response', listener);
  }
}

const [sources, courses, scholarships, statuses] = await Promise.all([
  readFile(join(root, 'src', 'data', 'sources.json'), 'utf8').then(JSON.parse),
  readFile(join(root, 'src', 'data', 'masters-course-directories.json'), 'utf8').then(JSON.parse),
  readFile(join(root, 'src', 'data', 'masters-scholarship-entries.json'), 'utf8').then(JSON.parse),
  readFile(join(root, 'src', 'data', 'status.json'), 'utf8').then(JSON.parse),
]);
const targets = unavailableTargets([...sources, ...courses, ...scholarshipLinks(scholarships)], statuses);
const headed = process.env.HEADED === '1';
const browser = await chromium.launch({ channel: 'chrome', headless: !headed });
const results = [];

try {
  for (const [index, { host, target }] of targets.entries()) {
    const context = await browser.newContext({ locale: 'en-GB', timezoneId: 'Europe/London' });
    const page = await context.newPage();
    page.on('dialog', (dialog) => dialog.dismiss().catch(() => undefined));
    const home = await visit(page, `${new URL(target.url).origin}/`);
    const targetResult = await visit(page, target.url);
    const result = { host, url: target.url, home, target: targetResult };
    results.push(result);
    console.log(JSON.stringify(result));
    await context.close();
    if (index < targets.length - 1) await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
} finally {
  await browser.close();
}

const mode = headed ? 'headed Chrome in Xvfb' : 'Chrome new headless';
const recovered = results.filter((item) => item.target.accessible).length;
const summary = [
  `# Official Google Chrome session probe: ${mode}`,
  '',
  `Recovered representative target pages: ${recovered}/${results.length}`,
  '',
  '| Host | Homepage | Target | Title |',
  '| --- | --- | --- | --- |',
  ...results.map((item) => `| ${item.host} | ${item.home.status ?? 'error'} | ${item.target.status ?? 'error'} | ${item.target.title?.replaceAll('|', '\\|') ?? ''} |`),
  '',
].join('\n');
console.log(`\n${summary}`);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' });

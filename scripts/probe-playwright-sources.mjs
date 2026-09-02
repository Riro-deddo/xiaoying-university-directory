import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const timeoutMs = 35_000;
const browserHeaders = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-GB,en;q=0.9',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
  'upgrade-insecure-requests': '1',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
};

function availableScholarshipLinks(entries) {
  return entries.flatMap((entry) => entry.entryState === 'available' ? entry.links : []);
}

function uniqueUnavailableHosts(targets, statuses) {
  const representatives = new Map();
  for (const target of targets) {
    if (statuses[target.id]?.health !== 'unavailable') continue;
    const host = new URL(target.url).hostname;
    if (!representatives.has(host)) representatives.set(host, target);
  }
  return [...representatives.entries()].map(([host, target]) => ({ host, target }));
}

function blockedPage({ status, title, text }) {
  const sample = `${title}\n${text}`.toLowerCase();
  if ([401, 403, 405, 406, 429].includes(status)) return `HTTP ${status}`;
  const markers = [
    'access denied',
    'attention required',
    'automated access',
    'bot detection',
    'enable javascript and cookies to continue',
    'forbidden',
    'just a moment',
    'request blocked',
  ];
  const marker = markers.find((candidate) => sample.includes(candidate));
  return marker ? `block page: ${marker}` : undefined;
}

async function fetchProbe(target) {
  try {
    const response = await fetch(target.url, {
      headers: browserHeaders,
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    const reason = blockedPage({ status: response.status, title: '', text: text.slice(0, 20_000) });
    return {
      accessible: response.ok && !reason && text.length > 200,
      finalUrl: response.url,
      responseBytes: text.length,
      status: response.status,
      reason: reason ?? (text.length <= 200 ? 'empty or very small response' : undefined),
    };
  } catch (error) {
    return {
      accessible: false,
      reason: error instanceof Error ? error.message : 'unknown fetch error',
    };
  }
}

async function browserProbe(browser, target) {
  const context = await browser.newContext({
    extraHTTPHeaders: { 'accept-language': 'en-GB,en;q=0.9' },
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on('dialog', (dialog) => dialog.dismiss().catch(() => undefined));

  try {
    const response = await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(1_500);
    const status = response?.status();
    const [title, text, html] = await Promise.all([
      page.title().catch(() => ''),
      page.locator('body').innerText({ timeout: 5_000 }).catch(() => ''),
      page.content().catch(() => ''),
    ]);
    const reason = blockedPage({ status, title, text: text.slice(0, 20_000) });
    return {
      accessible: Boolean(status && status >= 200 && status < 400 && !reason && text.trim().length > 100),
      finalUrl: page.url(),
      htmlBytes: html.length,
      responseTextLength: text.trim().length,
      status,
      title,
      reason: reason ?? (text.trim().length <= 100 ? 'empty or very small rendered page' : undefined),
    };
  } catch (error) {
    return {
      accessible: false,
      finalUrl: page.url(),
      reason: error instanceof Error ? error.message : 'unknown browser error',
    };
  } finally {
    await context.close();
  }
}

function markdown(results) {
  const fetchRecovered = results.filter((result) => result.fetch.accessible).length;
  const browserRecovered = results.filter((result) => result.browser.accessible).length;
  const rows = results.map((result) => {
    const fetchResult = result.fetch.accessible ? `yes (${result.fetch.status})` : `no (${result.fetch.status ?? 'error'})`;
    const browserResult = result.browser.accessible ? `yes (${result.browser.status})` : `no (${result.browser.status ?? 'error'})`;
    return `| ${result.host} | ${fetchResult} | ${browserResult} | ${result.browser.title?.replaceAll('|', '\\|') ?? ''} |`;
  });
  return [
    '# Playwright source-access probe',
    '',
    `Tested ${results.length} hosts that are currently marked unavailable.`,
    '',
    `- Browser-like HTTP recovered: ${fetchRecovered}/${results.length}`,
    `- Standard Playwright Chromium recovered: ${browserRecovered}/${results.length}`,
    '',
    '| Host | Browser-like HTTP | Playwright | Rendered title |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

const [chinaSources, courseDirectories, scholarshipEntries, statuses] = await Promise.all([
  readFile(join(root, 'src', 'data', 'sources.json'), 'utf8').then(JSON.parse),
  readFile(join(root, 'src', 'data', 'masters-course-directories.json'), 'utf8').then(JSON.parse),
  readFile(join(root, 'src', 'data', 'masters-scholarship-entries.json'), 'utf8').then(JSON.parse),
  readFile(join(root, 'src', 'data', 'status.json'), 'utf8').then(JSON.parse),
]);

const targets = [...chinaSources, ...courseDirectories, ...availableScholarshipLinks(scholarshipEntries)];
const representatives = uniqueUnavailableHosts(targets, statuses);
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const [index, { host, target }] of representatives.entries()) {
    const fetch = await fetchProbe(target);
    const browserResult = await browserProbe(browser, target);
    const result = { host, sourceId: target.id, url: target.url, fetch, browser: browserResult };
    results.push(result);
    console.log(JSON.stringify(result));
    if (index < representatives.length - 1) await new Promise((resolve) => setTimeout(resolve, 750));
  }
} finally {
  await browser.close();
}

const artifactPath = join(root, 'artifacts', 'playwright-source-probe.json');
await mkdir(dirname(artifactPath), { recursive: true });
await writeFile(artifactPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');

const summary = markdown(results);
console.log(`\n${summary}`);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' });

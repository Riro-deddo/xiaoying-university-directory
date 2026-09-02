import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const alreadyRecovered = new Set([
  'www.durham.ac.uk',
  'www.qmul.ac.uk',
  'www.qub.ac.uk',
  'www.rvc.ac.uk',
]);
const headers = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-GB,en;q=0.9',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
  'upgrade-insecure-requests': '1',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
};

function scholarshipLinks(entries) {
  return entries.flatMap((entry) => entry.entryState === 'available' ? entry.links : []);
}

function remainingHosts(targets, statuses) {
  const representatives = new Map();
  for (const target of targets) {
    if (statuses[target.id]?.health !== 'unavailable') continue;
    const host = new URL(target.url).hostname;
    if (alreadyRecovered.has(host) || representatives.has(host)) continue;
    representatives.set(host, target);
  }
  return [...representatives.entries()].map(([host, target]) => ({ host, target }));
}

function titleOf(html) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim();
}

function blockReason(status, html) {
  if ([401, 403, 405, 406, 429].includes(status)) return `HTTP ${status}`;
  const sample = html.slice(0, 30_000).toLowerCase();
  const markers = ['access denied', 'attention required', 'human verification', 'just a moment', 'request blocked'];
  const marker = markers.find((candidate) => sample.includes(candidate));
  return marker ? `block page: ${marker}` : undefined;
}

async function probe(url) {
  try {
    const response = await fetch(url, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });
    const html = await response.text();
    const reason = blockReason(response.status, html);
    return {
      accessible: response.ok && !reason && html.length > 200,
      bytes: html.length,
      finalUrl: response.url,
      status: response.status,
      title: titleOf(html),
      reason: reason ?? (html.length <= 200 ? 'empty or very small response' : undefined),
      body: html,
    };
  } catch (error) {
    return {
      accessible: false,
      reason: error instanceof Error ? error.message : 'unknown request error',
      body: '',
    };
  }
}

function withoutBody(result) {
  const { body: _body, ...summary } = result;
  return summary;
}

function markdown(runner, results) {
  const targetCount = results.filter((item) => item.target.accessible).length;
  const homeCount = results.filter((item) => item.home.accessible).length;
  const sitemapCount = results.filter((item) => item.sitemap.accessible).length;
  return [
    `# Official-source egress probe: ${runner}`,
    '',
    `Tested ${results.length} hosts still blocked after the browser-header recovery.`,
    '',
    `- Target pages accessible: ${targetCount}/${results.length}`,
    `- Official homepages accessible: ${homeCount}/${results.length}`,
    `- Official sitemaps accessible: ${sitemapCount}/${results.length}`,
    '',
    '| Host | Target | Homepage | Sitemap | Target listed in sitemap |',
    '| --- | --- | --- | --- | --- |',
    ...results.map((item) => `| ${item.host} | ${item.target.status ?? 'error'} | ${item.home.status ?? 'error'} | ${item.sitemap.status ?? 'error'} | ${item.targetListedInSitemap ? 'yes' : 'no'} |`),
    '',
  ].join('\n');
}

const [sources, courses, scholarships, statuses] = await Promise.all([
  readFile(join(root, 'src', 'data', 'sources.json'), 'utf8').then(JSON.parse),
  readFile(join(root, 'src', 'data', 'masters-course-directories.json'), 'utf8').then(JSON.parse),
  readFile(join(root, 'src', 'data', 'masters-scholarship-entries.json'), 'utf8').then(JSON.parse),
  readFile(join(root, 'src', 'data', 'status.json'), 'utf8').then(JSON.parse),
]);

const representatives = remainingHosts([...sources, ...courses, ...scholarshipLinks(scholarships)], statuses);
const results = [];

for (const [index, { host, target }] of representatives.entries()) {
  const origin = new URL(target.url).origin;
  const [targetResult, homeResult, sitemapResult] = await Promise.all([
    probe(target.url),
    probe(`${origin}/`),
    probe(`${origin}/sitemap.xml`),
  ]);
  const targetPath = new URL(target.url).pathname;
  const result = {
    host,
    sourceId: target.id,
    url: target.url,
    target: withoutBody(targetResult),
    home: withoutBody(homeResult),
    sitemap: withoutBody(sitemapResult),
    targetListedInSitemap: sitemapResult.accessible && sitemapResult.body.includes(targetPath),
  };
  results.push(result);
  console.log(JSON.stringify(result));
  if (index < representatives.length - 1) await new Promise((resolve) => setTimeout(resolve, 750));
}

const runner = process.env.RUNNER_OS ?? process.platform;
const summary = markdown(runner, results);
console.log(`\n${summary}`);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' });

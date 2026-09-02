import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const remainingBlockedHosts = new Set([
  'www.ox.ac.uk',
  'www.lshtm.ac.uk',
  'www.icr.ac.uk',
  'le.ac.uk',
  'www.dundee.ac.uk',
  'www.kingston.ac.uk',
  'www.bournemouth.ac.uk',
  'www.uea.ac.uk',
  'www.southwales.ac.uk',
]);
const blockMarkers = ['access denied', 'attention required', 'human verification', 'just a moment', 'request blocked'];
const officialAlternateSources = new Map([
  ['www.uea.ac.uk', {
    url: 'https://www.ueachina.cn/how-to-apply/',
    requiredText: ['获得UEA认可的中国大学学士学位', '平均成绩达到65%至75%', 'admissions@uea.ac.uk'],
  }],
]);

function representativeTargets(sources) {
  const byHost = new Map();
  for (const source of sources) {
    const host = new URL(source.url).hostname;
    if (!remainingBlockedHosts.has(host) || byHost.has(host)) continue;
    byHost.set(host, source);
  }
  return [...byHost.entries()].map(([host, source]) => ({ host, source }));
}

function expectedText(source) {
  return source.institutionRule?.verification?.requiredText ?? [];
}

function normalized(value) {
  return value.toLowerCase().replaceAll(/[*_`]/g, '').replaceAll(/\s+/g, ' ').trim();
}

function containsExpectedText(body, expected) {
  const haystack = normalized(body);
  return expected.some((value) => haystack.includes(normalized(value)));
}

async function fetchViaReader(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        DNT: '1',
        'X-Cache-Tolerance': '0',
        'X-Engine': 'browser',
        'X-No-Cache': 'true',
        'X-Timeout': '30',
      },
      signal: controller.signal,
    });
    const body = await response.text();
    const sample = normalized(body);
    return {
      body,
      status: response.status,
      blocked: blockMarkers.some((marker) => sample.includes(marker)),
      title: body.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? '',
    };
  } catch (error) {
    return {
      body: '',
      status: undefined,
      blocked: false,
      title: '',
      error: error instanceof Error ? error.message : 'unknown reader error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDirect(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'xiaoying-directory-source-check/1.0' },
      redirect: 'follow',
      signal: controller.signal,
    });
    const body = await response.text();
    return { body, status: response.status };
  } catch (error) {
    return {
      body: '',
      status: undefined,
      error: error instanceof Error ? error.message : 'unknown direct-fetch error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

const sources = JSON.parse(await readFile(join(root, 'src', 'data', 'sources.json'), 'utf8'));
const targets = representativeTargets(sources);
const results = [];

for (const [index, { host, source }] of targets.entries()) {
  const result = await fetchViaReader(source.url);
  const expected = expectedText(source);
  const readerTextMatched = containsExpectedText(result.body, expected);
  const readerAccessible = result.status === 200
    && result.body.length > 200
    && !result.blocked
    && readerTextMatched;
  const alternate = officialAlternateSources.get(host);
  const alternateResult = !readerAccessible && alternate ? await fetchDirect(alternate.url) : undefined;
  const alternateTextMatched = Boolean(alternateResult
    && alternate.requiredText.every((value) => alternateResult.body.includes(value)));
  const alternateAccessible = Boolean(alternateResult
    && alternateResult.status === 200
    && alternateResult.body.length > 200
    && alternateTextMatched);
  const item = {
    host,
    url: source.url,
    status: readerAccessible ? result.status : alternateResult?.status ?? result.status,
    title: readerAccessible ? result.title : alternateAccessible ? 'UEA Chinese official website' : result.title,
    textLength: readerAccessible ? result.body.length : alternateResult?.body.length ?? result.body.length,
    expectedTextMatched: readerAccessible ? readerTextMatched : alternateTextMatched,
    accessible: readerAccessible || alternateAccessible,
    route: readerAccessible ? 'reader' : alternateAccessible ? 'official-microsite' : 'unavailable',
    alternateUrl: alternateAccessible ? alternate.url : undefined,
    error: result.error,
  };
  results.push(item);
  console.log(JSON.stringify(item));
  if (index < targets.length - 1) await new Promise((resolve) => setTimeout(resolve, 3_200));
}

const recovered = results.filter((item) => item.accessible).length;
const summary = [
  '# Reader fallback probe',
  '',
  `Recovered official source pages with required-text validation: ${recovered}/${results.length}`,
  '',
  '| Host | Route | Status | Required text | Title |',
  '| --- | --- | --- | --- | --- |',
  ...results.map((item) => `| ${item.host} | ${item.route} | ${item.status ?? 'error'} | ${item.expectedTextMatched ? 'yes' : 'no'} | ${item.title.replaceAll('|', '\\|')} |`),
  '',
].join('\n');

console.log(`\n${summary}`);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' });

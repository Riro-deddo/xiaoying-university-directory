const requestTimeoutMs = 35_000;
const browserPreferredHosts = new Set([
  'search.cranfield.ac.uk',
  'www.arts.ac.uk',
  'www.cardiff.ac.uk',
  'www.citystgeorges.ac.uk',
  'www.gcu.ac.uk',
  'www.herts.ac.uk',
  'www.lsbu.ac.uk',
  'www.ntu.ac.uk',
  'www.ulster.ac.uk',
]);
const readerPreferredHosts = new Set([
  'le.ac.uk',
  'www.bournemouth.ac.uk',
  'www.dundee.ac.uk',
  'www.icr.ac.uk',
  'www.kingston.ac.uk',
  'www.lshtm.ac.uk',
  'www.ox.ac.uk',
  'www.southwales.ac.uk',
]);
const blockMarkers = [
  'access denied',
  'attention required',
  'human verification',
  'just a moment',
  'request blocked',
  'security verification',
];
const officialAlternates = new Map([
  ['uea-china-country-requirements', {
    url: 'https://www.ueachina.cn/how-to-apply/',
    requiredText: [
      '获得UEA认可的中国大学学士学位',
      '平均成绩达到65%至75%',
      'admissions@uea.ac.uk',
    ],
  }],
]);

const ordinaryHeaders = {
  'user-agent': 'Xiaoying-University-Directory/0.1 (+public educational link checker)',
};
const browserLikeHeaders = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-GB,en;q=0.9',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
  'upgrade-insecure-requests': '1',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
};
const readerHeaders = {
  DNT: '1',
  'X-Cache-Tolerance': '0',
  'X-Engine': 'browser',
  'X-No-Cache': 'true',
  'X-Timeout': '30',
};

function normalized(value) {
  return value.toLowerCase().replaceAll(/[*_`]/g, '').replaceAll(/\s+/g, ' ').trim();
}

function containsBlockMarker(body) {
  const sample = normalized(body);
  return blockMarkers.some((marker) => sample.includes(marker));
}

function isExplicitAccessFailure(status, body) {
  return status === undefined
    || status < 200
    || status >= 400
    || body.trim().length < 20
    || containsBlockMarker(body);
}

function containsAtLeastOneRequiredText(body, requiredText = []) {
  if (requiredText.length === 0) return true;
  const haystack = normalized(body);
  return requiredText.some((value) => haystack.includes(normalized(value)));
}

async function fetchHtml(fetchImpl, url, headers, timeoutMs = requestTimeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      headers,
      signal: controller.signal,
    });
    return {
      response,
      html: await response.text(),
      finalUrl: response.url || url,
    };
  } finally {
    clearTimeout(timer);
  }
}

function usableBrowserResult(result) {
  return result && !isExplicitAccessFailure(result.status, result.html ?? '');
}

function usableReaderResult(result, source) {
  if (isExplicitAccessFailure(result.response.status, result.html)) return false;
  if (!containsAtLeastOneRequiredText(result.html, source.requiredText)) return false;
  const declaredSource = result.html.match(/^URL Source:\s*(.+)$/mi)?.[1]?.trim();
  if (!declaredSource) return false;
  try {
    return new URL(declaredSource).hostname === new URL(source.url).hostname;
  } catch {
    return false;
  }
}

function syntheticUnavailable(source) {
  return {
    response: new Response('All safe access routes were exhausted.', { status: 503 }),
    html: 'All safe access routes were exhausted.',
    finalUrl: source.url,
    route: 'fallback-exhausted',
    checkedUrl: source.url,
  };
}

export function sourceFallbackPlan(source) {
  if (officialAlternates.has(source.id)) return ['official-alternate'];
  const host = new URL(source.url).hostname;
  if (readerPreferredHosts.has(host) || host === 'www.uea.ac.uk') return ['reader'];
  if (browserPreferredHosts.has(host)) return ['browser', 'reader'];
  return ['browser', 'reader'];
}

function createDefaultBrowserVisitor() {
  let browserPromise;
  const sessions = new Map();

  async function browser() {
    browserPromise ??= import('playwright').then(({ chromium }) => chromium.launch({
      channel: process.env.SOURCE_CHECK_BROWSER_CHANNEL ?? 'chrome',
      headless: process.env.SOURCE_CHECK_HEADED !== '1',
    }));
    return browserPromise;
  }

  async function sessionFor(source) {
    const origin = new URL(source.url).origin;
    if (!sessions.has(origin)) {
      sessions.set(origin, (async () => {
        const context = await (await browser()).newContext({
          locale: 'en-GB',
          timezoneId: 'Europe/London',
        });
        const page = await context.newPage();
        page.on('dialog', (dialog) => dialog.dismiss().catch(() => undefined));
        await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded', timeout: requestTimeoutMs }).catch(() => undefined);
        await page.waitForTimeout(2_500);
        return { context, page };
      })());
    }
    return sessions.get(origin);
  }

  return {
    async visit(source) {
      const { page } = await sessionFor(source);
      const response = await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: requestTimeoutMs });
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
      const html = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
      return { status: response?.status(), finalUrl: page.url(), html };
    },
    async close() {
      for (const session of sessions.values()) {
        const { context } = await session.catch(() => ({}));
        await context?.close().catch(() => undefined);
      }
      if (browserPromise) {
        const launchedBrowser = await browserPromise.catch(() => undefined);
        await launchedBrowser?.close().catch(() => undefined);
      }
    },
  };
}

export function createPageIdentityAccess(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const defaultBrowser = options.browserVisit ? undefined : createDefaultBrowserVisitor();
  const browserVisit = options.browserVisit ?? defaultBrowser.visit;

  return {
    async fetch(source) {
      const attempts = [];
      let lastHttpFailure;

      for (const [route, headers] of [['direct', ordinaryHeaders], ['browser-like', browserLikeHeaders]]) {
        try {
          const result = await fetchHtml(fetchImpl, source.url, headers, options.timeoutMs);
          attempts.push(`${route}:${result.response.status}`);
          if (!isExplicitAccessFailure(result.response.status, result.html)) {
            return { ...result, route, checkedUrl: source.url, attempts };
          }
          lastHttpFailure = result;
        } catch (error) {
          attempts.push(`${route}:error:${error instanceof Error ? error.message : 'unknown error'}`);
        }
      }

      for (const route of sourceFallbackPlan(source)) {
        if (route === 'browser') {
          try {
            const result = await browserVisit(source);
            attempts.push(`browser:${result?.status ?? 'error'}`);
            if (usableBrowserResult(result)) {
              return {
                response: new Response(result.html, { status: result.status }),
                html: result.html,
                finalUrl: result.finalUrl || source.url,
                route,
                checkedUrl: source.url,
                attempts,
              };
            }
          } catch (error) {
            attempts.push(`browser:error:${error instanceof Error ? error.message : 'unknown error'}`);
          }
          continue;
        }

        if (route === 'reader') {
          const readerUrl = `https://r.jina.ai/${source.url}`;
          try {
            const result = await fetchHtml(fetchImpl, readerUrl, readerHeaders, options.readerTimeoutMs ?? 90_000);
            attempts.push(`reader:${result.response.status}`);
            if (usableReaderResult(result, source)) {
              return { ...result, finalUrl: source.url, route, checkedUrl: readerUrl, attempts };
            }
          } catch (error) {
            attempts.push(`reader:error:${error instanceof Error ? error.message : 'unknown error'}`);
          }
          continue;
        }

        if (route === 'official-alternate') {
          const alternate = officialAlternates.get(source.id);
          try {
            const result = await fetchHtml(fetchImpl, alternate.url, browserLikeHeaders, options.timeoutMs);
            attempts.push(`official-alternate:${result.response.status}`);
            const valid = !isExplicitAccessFailure(result.response.status, result.html)
              && alternate.requiredText.every((value) => normalized(result.html).includes(normalized(value)));
            if (valid) {
              return {
                ...result,
                finalUrl: source.url,
                route,
                checkedUrl: alternate.url,
                requiredText: alternate.requiredText,
                attempts,
              };
            }
          } catch (error) {
            attempts.push(`official-alternate:error:${error instanceof Error ? error.message : 'unknown error'}`);
          }
        }
      }

      const unavailable = syntheticUnavailable(source);
      return {
        ...unavailable,
        response: lastHttpFailure?.response?.status >= 400 ? lastHttpFailure.response : unavailable.response,
        attempts,
      };
    },
    async close() {
      await defaultBrowser?.close();
    },
  };
}

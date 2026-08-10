function cleanSignal(value) {
  return value
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&nbsp;/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function extractTitleAndHeadingSignals(html) {
  const signals = [...html.matchAll(/<(title|h1)\b[^>]*>([\s\S]*?)<\/\1>/giu)]
    .map((match) => match[2]);
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/giu)) {
    if (!/\b(?:property|name)=["']og:title["']/iu.test(tag)) continue;
    const content = tag.match(/\bcontent=["']([^"']+)["']/iu)?.[1];
    if (content) signals.push(content);
  }
  return signals.map(cleanSignal).filter(Boolean).join('\n');
}

const patterns = {
  qs: /\bQS World University Rankings?\s*[:\-–—]?\s*(20\d{2})\b/giu,
  the: /\b(?:THE\s+)?World University Rankings?\s*[:\-–—]?\s*(20\d{2})\b/giu,
};

const providerSpecificPatterns = {
  qs: [],
  the: [
    /\bBest universities in the UK\s+(20\d{2})\s*[-\u2013\u2014]\s*University Rankings\b/giu,
  ],
};

export function detectRankingEdition(html, provider) {
  if (typeof html !== 'string') throw new TypeError('html must be a string');
  if (!Object.hasOwn(patterns, provider)) throw new TypeError(`Unsupported ranking provider: ${provider}`);

  const signals = extractTitleAndHeadingSignals(html);
  const matches = [
    ...signals.matchAll(patterns[provider]),
    ...providerSpecificPatterns[provider].flatMap((pattern) => [...signals.matchAll(pattern)]),
  ];
  const editions = new Set(matches.map((match) => Number(match[1])));
  return editions.size === 1 ? editions.values().next().value : undefined;
}

function validateRelease(release) {
  if (!release || typeof release !== 'object') throw new TypeError('Each ranking release must be an object');
  if (!Object.hasOwn(patterns, release.provider)) {
    throw new TypeError(`Unsupported ranking provider: ${release.provider}`);
  }
  if (!Number.isInteger(release.edition)) throw new TypeError('Ranking release edition must be an integer');
  if (typeof release.sourceUrl !== 'string' || !release.sourceUrl.startsWith('https://')) {
    throw new TypeError('Ranking release sourceUrl must be an HTTPS URL');
  }
}

function baseResult(release, checkedAt) {
  return {
    provider: release.provider,
    sourceUrl: release.sourceUrl,
    reviewedEdition: release.edition,
    checkedAt,
  };
}

function errorNotice(error) {
  return error instanceof Error ? error.message : 'Ranking page could not be read';
}

async function inspectRelease(release, fetchImpl, checkedAt) {
  const base = baseResult(release, checkedAt);
  try {
    const response = await fetchImpl(release.sourceUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'user-agent': 'Xiaoying-University-Directory/0.1 (+public educational ranking edition monitor)',
      },
    });
    if (!response.ok) {
      return {
        ...base,
        status: 'unavailable',
        httpStatus: response.status,
        notice: `Ranking page returned HTTP ${response.status}`,
      };
    }

    const detectedEdition = detectRankingEdition(await response.text(), release.provider);
    if (detectedEdition === undefined) {
      return {
        ...base,
        status: 'unverified',
        notice: 'No single ranking edition could be verified from page-level signals',
      };
    }
    if (detectedEdition < release.edition) {
      return {
        ...base,
        detectedEdition,
        status: 'unverified',
        notice: 'Detected edition predates the reviewed edition',
      };
    }
    return {
      ...base,
      detectedEdition,
      status: detectedEdition === release.edition ? 'current' : 'new-edition',
    };
  } catch (error) {
    return {
      ...base,
      status: 'unavailable',
      notice: errorNotice(error),
    };
  }
}

export async function inspectRankingEditions({ releases, fetchImpl, checkedAt }) {
  if (!Array.isArray(releases)) throw new TypeError('releases must be an array');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  if (typeof checkedAt !== 'string' || !checkedAt) throw new TypeError('checkedAt must be a non-empty string');
  for (const release of releases) validateRelease(release);

  const results = [];
  for (const release of releases) {
    results.push(await inspectRelease(release, fetchImpl, checkedAt));
  }
  return { checkedAt, results };
}

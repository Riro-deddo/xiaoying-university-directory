import { describe, expect, it, vi } from 'vitest';
import {
  detectRankingEdition,
  inspectRankingEditions,
} from '../scripts/ranking-edition-monitor.mjs';

const checkedAt = '2026-08-10T12:34:56.000Z';
const releases = [
  {
    provider: 'qs',
    rankingName: 'QS World University Rankings',
    edition: 2027,
    country: 'United Kingdom',
    sourceUrl: 'https://www.topuniversities.com/world-university-rankings?countries=gb',
    attribution: 'QS World University Rankings 2027',
    verifiedAt: '2026-08-08',
  },
  {
    provider: 'the',
    rankingName: 'Times Higher Education World University Rankings',
    edition: 2026,
    country: 'United Kingdom',
    sourceUrl: 'https://www.timeshighereducation.com/student/best-universities/best-universities-UK',
    attribution: 'Times Higher Education World University Rankings 2026',
    verifiedAt: '2026-08-08',
  },
];

describe('detectRankingEdition', () => {
  it('detects a QS edition from the page title', () => {
    expect(detectRankingEdition('<title>QS World University Rankings 2027</title>', 'qs')).toBe(2027);
  });

  it('detects a THE edition from the primary heading', () => {
    expect(detectRankingEdition('<h1>World University Rankings 2026</h1>', 'the')).toBe(2026);
  });

  it('detects current and newer THE UK editions from the configured official page title format', () => {
    expect(detectRankingEdition(
      '<title>Best universities in the UK 2026 - University Rankings</title>',
      'the',
    )).toBe(2026);
    expect(detectRankingEdition(
      '<h1>Best universities in the UK 2027 - University Rankings</h1>',
      'the',
    )).toBe(2027);
  });

  it('rejects ambiguous and unrelated THE UK page-level signals', () => {
    expect(detectRankingEdition([
      '<title>Best universities in the UK 2026 - University Rankings</title>',
      '<h1>Best universities in the UK 2027 - University Rankings</h1>',
    ].join(''), 'the')).toBeUndefined();
    expect(detectRankingEdition(
      '<title>Best universities in France 2027 - University Rankings</title>',
      'the',
    )).toBeUndefined();
    expect(detectRankingEdition(
      '<p>Best universities in the UK 2028 - University Rankings</p>',
      'the',
    )).toBeUndefined();
  });

  it('returns undefined when trusted page-level signals conflict', () => {
    expect(detectRankingEdition(
      '<title>QS World University Rankings 2027</title><h1>QS World University Rankings 2028</h1>',
      'qs',
    )).toBeUndefined();
  });

  it('uses og:title but ignores matching text elsewhere in the body', () => {
    const html = [
      '<meta content="QS World University Rankings&nbsp;2028" property="og:title">',
      '<p>QS World University Rankings 2029</p>',
    ].join('');

    expect(detectRankingEdition(html, 'qs')).toBe(2028);
  });

  it('returns undefined when no trusted signal names an edition', () => {
    expect(detectRankingEdition('<title>University rankings</title>', 'qs')).toBeUndefined();
  });

  it('rejects invalid input types and providers', () => {
    expect(() => detectRankingEdition(null, 'qs')).toThrow(TypeError);
    expect(() => detectRankingEdition('<title>Rankings</title>', 'other')).toThrow(TypeError);
  });
});

describe('inspectRankingEditions', () => {
  it('reports newer and current editions without mutating reviewed releases', async () => {
    const original = structuredClone(releases);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('<title>QS World University Rankings 2028</title>'))
      .mockResolvedValueOnce(new Response('<h1>THE World University Rankings 2026</h1>'));

    const audit = await inspectRankingEditions({ releases, fetchImpl, checkedAt });

    expect(audit).toEqual({
      checkedAt,
      results: [
        {
          provider: 'qs',
          sourceUrl: releases[0].sourceUrl,
          reviewedEdition: 2027,
          detectedEdition: 2028,
          status: 'new-edition',
          checkedAt,
        },
        {
          provider: 'the',
          sourceUrl: releases[1].sourceUrl,
          reviewedEdition: 2026,
          detectedEdition: 2026,
          status: 'current',
          checkedAt,
        },
      ],
    });
    expect(releases).toEqual(original);
    expect(fetchImpl).toHaveBeenNthCalledWith(1, releases[0].sourceUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'user-agent': 'Xiaoying-University-Directory/0.1 (+public educational ranking edition monitor)',
      },
    });
  });

  it.each([
    {
      label: 'missing edition',
      body: '<title>QS World University Rankings</title>',
      expected: { status: 'unverified' },
    },
    {
      label: 'ambiguous edition',
      body: '<title>QS World University Rankings 2027</title><h1>QS World University Rankings 2028</h1>',
      expected: { status: 'unverified' },
    },
    {
      label: 'older edition',
      body: '<title>QS World University Rankings 2026</title>',
      expected: { status: 'unverified', detectedEdition: 2026 },
    },
  ])('returns an unverified result for a $label', async ({ body, expected }) => {
    const audit = await inspectRankingEditions({
      releases: [releases[0]],
      fetchImpl: vi.fn().mockResolvedValue(new Response(body)),
      checkedAt,
    });

    expect(audit.results[0]).toMatchObject(expected);
    expect(audit.results[0].notice).toEqual(expect.any(String));
  });

  it('returns unavailable for a non-OK response without reading it as a ranking page', async () => {
    const audit = await inspectRankingEditions({
      releases: [releases[0]],
      fetchImpl: vi.fn().mockResolvedValue(new Response('QS World University Rankings 2099', { status: 403 })),
      checkedAt,
    });

    expect(audit.results[0]).toMatchObject({ status: 'unavailable', httpStatus: 403 });
    expect(audit.results[0]).not.toHaveProperty('detectedEdition');
  });

  it('returns unavailable when fetching or reading a page throws', async () => {
    const thrownFetchAudit = await inspectRankingEditions({
      releases: [releases[0]],
      fetchImpl: vi.fn().mockRejectedValue(new Error('network blocked')),
      checkedAt,
    });
    const thrownReadAudit = await inspectRankingEditions({
      releases: [releases[0]],
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockRejectedValue(new Error('body interrupted')),
      }),
      checkedAt,
    });

    expect(thrownFetchAudit.results[0]).toMatchObject({ status: 'unavailable', notice: 'network blocked' });
    expect(thrownReadAudit.results[0]).toMatchObject({ status: 'unavailable', notice: 'body interrupted' });
  });
});

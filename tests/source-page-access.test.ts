import { describe, expect, it, vi } from 'vitest';
import {
  createPageIdentityAccess,
  sourceFallbackPlan,
} from '../scripts/source-page-access.mjs';

const source = {
  id: 'masters-example',
  url: 'https://www.example.ac.uk/postgraduate/',
  monitorMode: 'page-identity',
  requiredText: ['Postgraduate', 'courses'],
};

const response = (status: number, body = '', url = source.url) => ({
  response: new Response(body, { status, headers: { 'content-type': 'text/html' } }),
  finalUrl: url,
});

describe('layered page identity access', () => {
  it('uses the ordinary request only when the official page is accessible', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<h1>Postgraduate courses</h1>', { status: 200 }));
    const browserVisit = vi.fn();
    const access = createPageIdentityAccess({ fetchImpl, browserVisit });

    const result = await access.fetch(source);

    expect(result).toMatchObject({ route: 'direct', html: '<h1>Postgraduate courses</h1>' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(browserVisit).not.toHaveBeenCalled();
    await access.close();
  });

  it('retries an explicit block with browser-like request headers before heavier fallbacks', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('Access denied', { status: 403 }))
      .mockResolvedValueOnce(new Response('<h1>Postgraduate courses</h1>', { status: 200 }));
    const browserVisit = vi.fn();
    const access = createPageIdentityAccess({ fetchImpl, browserVisit });

    const result = await access.fetch(source);

    expect(result.route).toBe('browser-like');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][1].headers).toMatchObject({
      accept: expect.stringContaining('text/html'),
      'accept-language': expect.stringContaining('en-GB'),
    });
    expect(browserVisit).not.toHaveBeenCalled();
    await access.close();
  });

  it('uses an official Chrome session for a browser-planned host after both HTTP attempts are blocked', async () => {
    const cardiffSource = { ...source, url: 'https://www.cardiff.ac.uk/study/postgraduate' };
    const fetchImpl = vi.fn().mockResolvedValue(new Response('Access denied', { status: 403 }));
    const browserVisit = vi.fn().mockResolvedValue({
      status: 200,
      finalUrl: cardiffSource.url,
      html: '<h1>Postgraduate courses</h1>',
    });
    const access = createPageIdentityAccess({ fetchImpl, browserVisit });

    const result = await access.fetch(cardiffSource);

    expect(sourceFallbackPlan(cardiffSource)).toEqual(['browser', 'reader']);
    expect(result.route).toBe('browser');
    expect(browserVisit).toHaveBeenCalledWith(cardiffSource);
    await access.close();
  });

  it('uses Reader with cache bypass only for a validated official source page', async () => {
    const oxfordSource = { ...source, url: 'https://www.ox.ac.uk/admissions/graduate/courses' };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('Access denied', { status: 403 }))
      .mockResolvedValueOnce(new Response('Access denied', { status: 403 }))
      .mockResolvedValueOnce(new Response([
        `Title: Postgraduate courses`,
        `URL Source: ${oxfordSource.url}`,
        '',
        'Postgraduate courses '.repeat(30),
      ].join('\n'), { status: 200 }));
    const browserVisit = vi.fn();
    const access = createPageIdentityAccess({ fetchImpl, browserVisit });

    const result = await access.fetch(oxfordSource);

    expect(sourceFallbackPlan(oxfordSource)).toEqual(['reader']);
    expect(result.route).toBe('reader');
    expect(result.finalUrl).toBe(oxfordSource.url);
    expect(fetchImpl.mock.calls[2][0]).toBe(`https://r.jina.ai/${oxfordSource.url}`);
    expect(fetchImpl.mock.calls[2][1].headers).toMatchObject({
      DNT: '1',
      'X-Cache-Tolerance': '0',
      'X-Engine': 'browser',
      'X-No-Cache': 'true',
    });
    expect(browserVisit).not.toHaveBeenCalled();
    await access.close();
  });

  it('does not treat an unvalidated Reader response as a successful official check', async () => {
    const oxfordSource = { ...source, url: 'https://www.ox.ac.uk/admissions/graduate/courses' };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('Access denied', { status: 403 }))
      .mockResolvedValueOnce(new Response('Access denied', { status: 403 }))
      .mockResolvedValueOnce(new Response('Title: Human Verification\nURL Source: https://www.ox.ac.uk/', { status: 200 }));
    const access = createPageIdentityAccess({ fetchImpl, browserVisit: vi.fn() });

    const result = await access.fetch(oxfordSource);

    expect(result.route).toBe('fallback-exhausted');
    expect(result.response.ok).toBe(false);
    await access.close();
  });

  it('uses the UEA-endorsed Chinese official site only for the matching China-requirements source', async () => {
    const ueaSource = {
      ...source,
      id: 'uea-china-country-requirements',
      url: 'https://www.uea.ac.uk/study/international-students/country-map/china',
      requiredText: ['Bachelor Degree from a recognised institution'],
    };
    const alternateBody = [
      '获得UEA认可的中国大学学士学位',
      '平均成绩达到65%至75%',
      'admissions@uea.ac.uk',
      'UEA中国学生研究生申请说明'.repeat(30),
    ].join('\n');
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('Human Verification', { status: 403 }))
      .mockResolvedValueOnce(new Response('Human Verification', { status: 403 }))
      .mockResolvedValueOnce(new Response(alternateBody, { status: 200 }));
    const access = createPageIdentityAccess({ fetchImpl, browserVisit: vi.fn() });

    const result = await access.fetch(ueaSource);

    expect(sourceFallbackPlan(ueaSource)).toEqual(['official-alternate']);
    expect(result).toMatchObject({
      route: 'official-alternate',
      checkedUrl: 'https://www.ueachina.cn/how-to-apply/',
      requiredText: ['获得UEA认可的中国大学学士学位', '平均成绩达到65%至75%', 'admissions@uea.ac.uk'],
    });
    await access.close();
  });

  it('returns a real 200 page with missing anchors for review instead of masking the change with a fallback', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<main>This is the redesigned official degree finder with enough genuine page content.</main>'.repeat(5), { status: 200 }));
    const browserVisit = vi.fn().mockResolvedValue(response(200, '<h1>Postgraduate courses</h1>'));
    const access = createPageIdentityAccess({ fetchImpl, browserVisit });

    const result = await access.fetch(source);

    expect(result.route).toBe('direct');
    expect(browserVisit).not.toHaveBeenCalled();
    await access.close();
  });
});

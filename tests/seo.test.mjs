import { describe, expect, it } from 'vitest';

const siteRoot = 'https://riro-deddo.github.io/xiaoying-university-directory/';
const methodologyUrl = `${siteRoot}methodology/`;

const validArtifacts = {
  homeHtml: `<html><head><link rel="canonical" href="${siteRoot}" /></head></html>`,
  methodologyHtml: `<html><head><link rel="canonical" href="${methodologyUrl}" /></head></html>`,
  sitemapXml: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${siteRoot}</loc></url>
  <url><loc>${methodologyUrl}</loc></url>
</urlset>`,
};

describe('Google indexing signals', () => {
  it('builds stable public URLs under the exact GitHub Pages root', async () => {
    const { publicUrl } = await import('../src/lib/seo.ts');

    expect(publicUrl()).toBe(siteRoot);
    expect(publicUrl('methodology/')).toBe(methodologyUrl);
    expect(publicUrl('/sitemap.xml')).toBe(`${siteRoot}sitemap.xml`);
  });

  it('serves exactly the two public HTML routes in the sitemap', async () => {
    const { GET } = await import('../src/pages/sitemap.xml.ts');
    const response = await GET({});
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    expect(xml.match(/<url>/gu)).toHaveLength(2);
    expect(xml).toContain(`<loc>${siteRoot}</loc>`);
    expect(xml).toContain(`<loc>${methodologyUrl}</loc>`);
  });

  it('accepts the complete production SEO artifact contract', async () => {
    const { inspectSeoArtifacts } = await import('../scripts/check-seo-artifacts.mjs');

    expect(() => inspectSeoArtifacts(validArtifacts)).not.toThrow();
  });

  it.each([
    ['wrong homepage canonical', { homeHtml: '<link rel="canonical" href="https://example.com/" />' }],
    ['wrong methodology canonical', { methodologyHtml: '<link rel="canonical" href="https://example.com/methodology/" />' }],
    ['noindex directive', { homeHtml: `${validArtifacts.homeHtml}<meta name="robots" content="noindex" />` }],
    ['unexpected sitemap URL', { sitemapXml: validArtifacts.sitemapXml.replace(methodologyUrl, `${siteRoot}extra/`) }],
  ])('rejects %s', async (_label, mutation) => {
    const { inspectSeoArtifacts } = await import('../scripts/check-seo-artifacts.mjs');

    expect(() => inspectSeoArtifacts({ ...validArtifacts, ...mutation })).toThrow();
  });
});

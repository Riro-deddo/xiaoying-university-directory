import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = 'https://riro-deddo.github.io/xiaoying-university-directory/';
const methodologyUrl = `${siteRoot}methodology/`;

function requireCanonical(html, url, label) {
  const canonicalTags = html.match(/<link\b(?=[^>]*\brel="canonical")[^>]*>/giu) ?? [];
  if (!canonicalTags.some((tag) => tag.includes(`href="${url}"`))) {
    throw new Error(`${label} is missing its production canonical URL`);
  }
}

export function inspectSeoArtifacts({ homeHtml, methodologyHtml, sitemapXml }) {
  requireCanonical(homeHtml, siteRoot, 'Homepage');
  requireCanonical(methodologyHtml, methodologyUrl, 'Methodology page');

  if (/noindex/iu.test(`${homeHtml}\n${methodologyHtml}`)) {
    throw new Error('Public pages must not contain a noindex directive');
  }
  const sitemapLocations = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
  const expectedLocations = [siteRoot, methodologyUrl];
  if (sitemapLocations.length !== expectedLocations.length
    || sitemapLocations.some((location, index) => location !== expectedLocations[index])) {
    throw new Error('sitemap.xml must contain exactly the two approved public routes');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [homeHtml, methodologyHtml, sitemapXml] = await Promise.all([
    readFile(join(root, 'dist', 'index.html'), 'utf8'),
    readFile(join(root, 'dist', 'methodology', 'index.html'), 'utf8'),
    readFile(join(root, 'dist', 'sitemap.xml'), 'utf8'),
  ]);

  inspectSeoArtifacts({ homeHtml, methodologyHtml, sitemapXml });
  console.log('SEO artifact guard passed: canonical URLs and sitemap.xml are valid.');
}

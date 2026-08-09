# Google Indexing Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add crawl discovery and canonical URL signals for the two public pages without changing the user interface or university data.

**Architecture:** Keep the production GitHub Pages root and public routes in one small SEO module. Astro static endpoints render `robots.txt` and `sitemap.xml`; both HTML pages consume the same canonical URL helper. A focused test exercises the endpoint responses and page contracts, while the production build verifies that Astro emits the files.

**Tech Stack:** Astro 7 static output, TypeScript, Vitest, pnpm, GitHub Pages.

## Global Constraints

- Production root is exactly `https://riro-deddo.github.io/xiaoying-university-directory/`.
- Do not change any university, Chinese institution, ranking, requirement, source-status, or generated data fact.
- Do not change desktop or mobile visual layout.
- Do not add a paid service, database, runtime server, or keyword-stuffed content.
- Indexing signals improve discovery but do not guarantee indexing time or search position.

---

### Task 1: Static discovery and canonical signals

**Files:**
- Create: `src/lib/seo.ts`
- Create: `src/pages/robots.txt.ts`
- Create: `src/pages/sitemap.xml.ts`
- Create: `scripts/check-seo-artifacts.mjs`
- Create: `tests/seo.test.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/methodology.astro`
- Modify: `package.json`

**Interfaces:**
- Produces: `PUBLIC_SITE_ROOT: URL`, `PUBLIC_ROUTES: readonly ['', 'methodology/']`, and `publicUrl(path?: string): string`.
- Produces: static Astro `GET` handlers for `/robots.txt` and `/sitemap.xml`.
- Consumes: the same `publicUrl` helper in both HTML pages for absolute canonical links.
- Produces: `inspectSeoArtifacts({ homeHtml, methodologyHtml, robotsText, sitemapXml }): void`, used by tests and postbuild against real emitted artifacts.

- [ ] **Step 1: Write the failing SEO contract test**

Create `tests/seo.test.ts` that imports `publicUrl`, both endpoint `GET` handlers, and `inspectSeoArtifacts`. Assert endpoint behavior with literal expected values:

```ts
expect(publicUrl()).toBe('https://riro-deddo.github.io/xiaoying-university-directory/');
expect(publicUrl('methodology/')).toBe('https://riro-deddo.github.io/xiaoying-university-directory/methodology/');
expect(await (await robotsGet({} as never)).text()).toContain(
  'Sitemap: https://riro-deddo.github.io/xiaoying-university-directory/sitemap.xml',
);
expect(await (await sitemapGet({} as never)).text()).toContain(
  '<loc>https://riro-deddo.github.io/xiaoying-university-directory/</loc>',
);
expect(await (await sitemapGet({} as never)).text()).toContain(
  '<loc>https://riro-deddo.github.io/xiaoying-university-directory/methodology/</loc>',
);
```

Also assert the robots response is `text/plain`, the sitemap response is XML, and exactly two `<url>` entries exist. Exercise `inspectSeoArtifacts` with literal valid HTML/robots/sitemap fixtures, then mutate each canonical URL and assert it throws; this verifies behavior rather than grepping implementation source.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
pnpm exec vitest run tests/seo.test.ts
```

Expected: FAIL because `src/lib/seo.ts`, the two endpoints, and the production artifact inspector do not exist.

- [ ] **Step 3: Implement the shared SEO URL module**

Create `src/lib/seo.ts`:

```ts
export const PUBLIC_SITE_ROOT = new URL('https://riro-deddo.github.io/xiaoying-university-directory/');
export const PUBLIC_ROUTES = ['', 'methodology/'] as const;

export function publicUrl(path = ''): string {
  return new URL(path.replace(/^\/+/, ''), PUBLIC_SITE_ROOT).href;
}
```

- [ ] **Step 4: Implement the static robots and sitemap endpoints**

Create `src/pages/robots.txt.ts` with an Astro `GET` handler returning:

```text
User-agent: *
Allow: /

Sitemap: https://riro-deddo.github.io/xiaoying-university-directory/sitemap.xml
```

Create `src/pages/sitemap.xml.ts` with an Astro `GET` handler that maps `PUBLIC_ROUTES` to two `<url><loc>...</loc></url>` entries inside the standard `http://www.sitemaps.org/schemas/sitemap/0.9` urlset. Set UTF-8 `text/plain` and `application/xml` content types respectively.

- [ ] **Step 5: Add canonical links to both pages**

In `src/pages/index.astro`, import `publicUrl`, assign `const canonicalUrl = publicUrl();`, and add:

```astro
<link rel="canonical" href={canonicalUrl} />
```

In `src/pages/methodology.astro`, assign `const canonicalUrl = publicUrl('methodology/');` and render the same canonical link in `<head>`.

- [ ] **Step 6: Add a production artifact guard**

Create `scripts/check-seo-artifacts.mjs`. Its exported `inspectSeoArtifacts` must require the exact homepage and methodology canonical links, reject `noindex`, require the robots sitemap declaration, and require exactly the two approved sitemap `<loc>` values. When executed directly, read `dist/index.html`, `dist/methodology/index.html`, `dist/robots.txt`, and `dist/sitemap.xml`, then print one success line.

Update `package.json` so `postbuild` runs both guards:

```json
"postbuild": "node scripts/check-initial-html.mjs && node scripts/check-seo-artifacts.mjs"
```

- [ ] **Step 7: Run focused and full verification**

Run:

```powershell
pnpm exec vitest run tests/seo.test.ts
pnpm test:run
pnpm build
git diff --check
```

Expected: focused and full tests pass; Astro builds `/robots.txt`, `/sitemap.xml`, `/index.html`, and `/methodology/index.html`; both postbuild guards pass against the real files; diff check reports no whitespace errors.

- [ ] **Step 8: Inspect protected scope and commit**

Confirm `git diff -- src/data public/generated src/styles` is empty. Then commit only the SEO implementation, test, spec, and plan:

```powershell
git add src/lib/seo.ts src/pages/robots.txt.ts src/pages/sitemap.xml.ts src/pages/index.astro src/pages/methodology.astro scripts/check-seo-artifacts.mjs tests/seo.test.ts package.json docs/superpowers/plans/2026-08-09-google-indexing.md
git commit -m "feat: add Google indexing signals"
```

import { parseHTML } from 'linkedom';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadUniversities } from '../src/lib/data';
import {
  chinaSourceActionModel,
  mastersScholarshipActionModel,
  mastersScholarshipKindCopy,
} from '../src/lib/presentation';
import { bindSourceDetailsKeyboard } from '../src/lib/source-actions';
import type {
  MastersScholarshipEntryWithStatus,
  MastersScholarshipLink,
  SourceWithStatus,
} from '../src/lib/types';

function source(id: string): SourceWithStatus {
  return {
    id,
    universityId: 'example-university',
    labelZh: `来源 ${id}`,
    url: `https://example.edu/${id}`,
    kind: 'china-requirements',
    scope: 'university',
    scopeZh: '全校',
    institutionRule: {
      type: 'none',
      summaryZh: '测试摘要。',
    },
    parser: {
      mode: 'link-only',
      guard: {
        minimumRecords: 0,
        maximumRecords: 0,
        maximumRemovalRatio: 0,
      },
    },
  };
}

function scholarshipLink(
  id: string,
  overrides: Partial<MastersScholarshipLink> = {},
): MastersScholarshipLink {
  return {
    id,
    universityId: 'example-university',
    labelZh: '查看硕士奖学金官网',
    scopeZh: '硕士奖学金官方目录',
    kind: 'masters-directory',
    requiresFiltering: false,
    url: `https://example.edu/${id}`,
    pageTitle: 'Scholarships',
    reviewedAt: '2026-08-31',
    requiredText: ['Scholarships', 'Masters'],
    monitorMode: 'page-identity',
    ...overrides,
  };
}

describe('China source action model', () => {
  it('keeps fewer than three China sources as peer links', () => {
    expect(chinaSourceActionModel([source('a'), source('b')])).toEqual({
      collapsed: false,
      count: 2,
      label: '中国硕士入学要求',
    });
  });

  it('collapses three China sources under an exact count label', () => {
    expect(chinaSourceActionModel([source('a'), source('b'), source('c')])).toEqual({
      collapsed: true,
      count: 3,
      label: '中国硕士入学要求（3 条）',
    });
  });
});

describe('masters scholarship action model', () => {
  it('renders one available link as a direct scholarship action', () => {
    expect(mastersScholarshipActionModel({
      universityId: 'one',
      entryState: 'available',
      reviewedAt: '2026-08-31',
      links: [scholarshipLink('one')],
    })).toEqual({
      entryState: 'available',
      collapsed: false,
      count: 1,
      label: '查看硕士奖学金官网',
    });
  });

  it('collapses multiple available links under their exact entry count', () => {
    expect(mastersScholarshipActionModel({
      universityId: 'one',
      entryState: 'available',
      reviewedAt: '2026-08-31',
      links: [scholarshipLink('one'), scholarshipLink('two')],
    })).toEqual({
      entryState: 'available',
      collapsed: true,
      count: 2,
      label: '查看硕士奖学金官网（2 个入口）',
    });
  });

  it('models no public entry as a non-clickable unavailable action', () => {
    const entry: MastersScholarshipEntryWithStatus = {
      universityId: 'one',
      entryState: 'no-public-entry',
      reviewedAt: '2026-08-31',
      links: [],
    };
    expect(mastersScholarshipActionModel(entry)).toEqual({
      entryState: 'no-public-entry',
      collapsed: false,
      count: 0,
      label: '未发现公开硕士奖学金入口',
    });
  });

  it.each([
    ['masters-directory', false, '官方奖学金目录'],
    ['masters-search', false, '官方奖学金搜索器'],
    ['postgraduate-funding', false, '研究生资助官网'],
    ['category', false, '官方分类资助入口'],
    ['postgraduate-funding', true, '研究生资助官网（含硕士，请筛选）'],
  ] as const)('renders %s kind copy with filtering=%s', (kind, requiresFiltering, expected) => {
    expect(mastersScholarshipKindCopy(scholarshipLink('kind', { kind, requiresFiltering }))).toBe(expected);
  });
});

describe('rendered source actions', () => {
  const rootUrl = new URL('../', import.meta.url);
  const root = decodeURIComponent(rootUrl.pathname).replace(/^\/([A-Za-z]:\/)/u, '$1');
  const universities = loadUniversities();
  let document: Document;

  beforeAll(async () => {
    const runtime = globalThis as typeof globalThis & { process: { env: Record<string, string | undefined> } };
    runtime.process.env.ASTRO_TELEMETRY_DISABLED = '1';
    const { build } = await import('astro');
    const fileSystemModule = 'node:fs/promises';
    const { readFile } = await import(/* @vite-ignore */ fileSystemModule) as {
      readFile(path: URL, encoding: 'utf8'): Promise<string>;
    };
    await build({ root, logLevel: 'silent' });
    const html = await readFile(new URL('dist/index.html', rootUrl), 'utf8');
    document = parseHTML(html).document;
  }, 30_000);

  it('renders one HTTPS masters course entry for each of the 101 university rows', () => {
    const rows = [...document.querySelectorAll<HTMLElement>('.university-row')];
    const actions = [...document.querySelectorAll<HTMLAnchorElement>(
      '.university-row > .source-actions > .masters-course-action',
    )];

    expect(rows).toHaveLength(101);
    expect(actions).toHaveLength(101);
    expect(new Set(actions.map((action) => action.closest<HTMLElement>('.university-row')?.dataset.id)).size)
      .toBe(101);
    for (const action of actions) {
      expect(action.href).toMatch(/^https:\/\//u);
      expect(action.querySelector('span')?.textContent).toBe('查看全部硕士课程');
      expect(action.querySelector('small')?.textContent).toBe('硕士专业官网入口');
    }
  });

  it('renders exactly one scholarship action root per row and all 106 available links', () => {
    const roots = [...document.querySelectorAll<HTMLElement>(
      '.university-row > .source-actions > :is(.masters-scholarship-action, .masters-scholarship-bundle)',
    )];
    const links = [...document.querySelectorAll<HTMLAnchorElement>(
      '.masters-scholarship-action[href], .masters-scholarship-bundle-list > a',
    )];
    const availableLinks = universities.flatMap((university) => university.mastersScholarships.links);

    expect(roots).toHaveLength(101);
    expect(new Set(roots.map((root) => root.closest<HTMLElement>('.university-row')?.dataset.id)).size).toBe(101);
    expect(links).toHaveLength(106);
    expect(links.map((link) => link.getAttribute('href')).sort()).toEqual(availableLinks.map((link) => link.url).sort());
  });

  it('renders Imperial as an ordinary direct scholarship link after its masters-course action', () => {
    const imperial = document.querySelector<HTMLElement>('[data-id="imperial-college-london"]')!;
    const actionGroup = imperial.querySelector<HTMLElement>('.source-actions')!;
    const expected = universities.find((university) => university.id === 'imperial-college-london')!
      .mastersScholarships.links[0]!;
    const action = actionGroup.querySelector<HTMLAnchorElement>(':scope > a.masters-scholarship-action')!;

    expect(actionGroup.children.item(actionGroup.children.length - 2)?.classList.contains('masters-course-action')).toBe(true);
    expect(actionGroup.lastElementChild).toBe(action);
    expect(action.href).toBe(expected.url);
    expect(action.querySelector('span')?.textContent).toBe('查看硕士奖学金官网');
    expect([...action.querySelectorAll('small')].map((item) => item.textContent)).toEqual([
      expected.scopeZh,
      '官方奖学金目录',
    ]);
  });

  it('renders ICR unavailable copy without a link, disclosure, or timestamp', () => {
    const icr = document.querySelector<HTMLElement>('[data-id="institute-of-cancer-research-london"]')!;
    const actionGroup = icr.querySelector<HTMLElement>('.source-actions')!;
    const action = actionGroup.querySelector<HTMLElement>(':scope > .masters-scholarship-action')!;

    expect(action.tagName).toBe('SPAN');
    expect(action.textContent).toBe('未发现公开硕士奖学金入口');
    expect(action.querySelector('a, details')).toBeNull();
    expect(action.textContent).not.toMatch(/2026|最近|检查/u);
  });

  it('shows the mandatory masters filtering copy on Oxford direct action', () => {
    const oxford = document.querySelector<HTMLElement>('[data-id="university-of-oxford"]')!;
    const action = oxford.querySelector<HTMLAnchorElement>('.masters-scholarship-action[href]')!;

    expect(action.textContent).toContain('含硕士，请筛选');
    expect([...action.querySelectorAll('small')].map((item) => item.textContent)).toEqual([
      '研究生资助官网（含硕士，请筛选）',
    ]);
    expect(action.textContent).not.toMatch(/2026|最近|检查/u);
  });

  it('keeps Imperial source links and its masters entry as peer actions', () => {
    const imperial = document.querySelector<HTMLElement>('[data-id="imperial-college-london"]')!;
    const actionGroup = imperial.querySelector<HTMLElement>('.source-actions')!;
    const expected = universities.find((university) => university.id === 'imperial-college-london')!;
    const directSourceLinks = [...actionGroup.children]
      .filter((child): child is HTMLAnchorElement => child.matches(
        'a:not(.masters-course-action):not(.masters-scholarship-action)',
      ));

    expect(actionGroup.querySelector('details')).toBeNull();
    expect(directSourceLinks.map((link) => link.href)).toEqual(expected.sources.map((item) => item.url));
    expect([...actionGroup.children].filter((child) => child.matches('.masters-course-action'))).toHaveLength(1);
    expect([...actionGroup.children].filter((child) => child.matches('.masters-scholarship-action'))).toHaveLength(1);
  });

  it('runs the real generic keyboard listener for China and scholarship disclosures without losing focus', () => {
    const manchester = document.querySelector<HTMLElement>('[data-id="university-of-manchester"]')!;
    const actionGroup = manchester.querySelector<HTMLElement>('.source-actions')!;
    const details = actionGroup.querySelector<HTMLDetailsElement>(':scope > details.china-source-bundle')!;
    const summary = details.querySelector<HTMLElement>(':scope > summary')!;
    const expected = universities.find((university) => university.id === 'university-of-manchester')!.sources;

    expect([...actionGroup.children].map((child) => child.tagName)).toEqual(['DETAILS', 'A', 'A']);
    expect(Boolean(details.open)).toBe(false);
    expect(summary.textContent).toBe('中国硕士入学要求（3 条）');
    expect(summary.parentElement).toBe(details);
    expect(summary.getAttribute('role')).toBeNull();
    expect(summary.getAttribute('tabindex')).toBeNull();

    let focusedElement: Element | null = null;
    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get: () => focusedElement,
    });
    summary.addEventListener('focus', () => { focusedElement = summary; });
    summary.addEventListener('blur', () => { focusedElement = null; });
    summary.focus();
    bindSourceDetailsKeyboard(document);

    const keydown = (key: string) => {
      const event = new document.defaultView!.Event('keydown', {
        bubbles: true,
        cancelable: true,
      }) as KeyboardEvent;
      Object.defineProperty(event, 'key', { value: key });
      summary.dispatchEvent(event);
      return event;
    };

    const enter = keydown('Enter');
    expect(details.open).toBe(true);
    expect(enter.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(summary);

    const sourceLinks = [...details.querySelectorAll<HTMLAnchorElement>('.china-source-bundle-list > a')];
    expect(sourceLinks.map((link) => ({
      href: link.href,
      label: link.querySelector('span')?.textContent,
    }))).toEqual(expected.map((item) => ({ href: item.url, label: item.labelZh })));
    expect(new Set(sourceLinks.map((link) => link.href)).size).toBe(3);

    const space = keydown(' ');
    expect(details.open).toBe(false);
    expect(space.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(summary);

    const arrowDown = keydown('ArrowDown');
    expect(details.open).toBe(false);
    expect(arrowDown.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(summary);

    const lstm = document.querySelector<HTMLElement>('[data-id="liverpool-school-of-tropical-medicine"]')!;
    const scholarshipDetails = lstm.querySelector<HTMLDetailsElement>('.masters-scholarship-bundle')!;
    const scholarshipSummary = scholarshipDetails.querySelector<HTMLElement>(':scope > summary')!;
    const scholarshipExpected = universities.find(
      (university) => university.id === 'liverpool-school-of-tropical-medicine',
    )!.mastersScholarships.links;

    scholarshipSummary.addEventListener('focus', () => { focusedElement = scholarshipSummary; });
    scholarshipSummary.addEventListener('blur', () => { focusedElement = null; });
    scholarshipSummary.focus();
    const scholarshipKeydown = (key: string) => {
      const event = new document.defaultView!.Event('keydown', { bubbles: true, cancelable: true }) as KeyboardEvent;
      Object.defineProperty(event, 'key', { value: key });
      scholarshipSummary.dispatchEvent(event);
      return event;
    };

    const scholarshipEnter = scholarshipKeydown('Enter');
    expect(scholarshipDetails.open).toBe(true);
    expect(scholarshipEnter.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(scholarshipSummary);
    expect(scholarshipSummary.textContent).toBe('查看硕士奖学金官网（2 个入口）');
    expect([...scholarshipDetails.querySelectorAll<HTMLAnchorElement>('.masters-scholarship-bundle-list > a')]
      .map((link) => ({ href: link.href, text: link.textContent })))
      .toEqual(scholarshipExpected.map((link) => ({
        href: link.url,
        text: `${link.labelZh}${link.scopeZh}官方分类资助入口（含硕士，请筛选）`,
      })));

    const scholarshipSpace = scholarshipKeydown(' ');
    expect(scholarshipDetails.open).toBe(false);
    expect(scholarshipSpace.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(scholarshipSummary);

    const scholarshipArrowDown = scholarshipKeydown('ArrowDown');
    expect(scholarshipDetails.open).toBe(false);
    expect(scholarshipArrowDown.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(scholarshipSummary);
  });
});

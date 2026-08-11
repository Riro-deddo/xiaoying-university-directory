import { parseHTML } from 'linkedom';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadUniversities } from '../src/lib/data';
import { chinaSourceActionModel } from '../src/lib/presentation';
import { bindChinaSourceDetailsKeyboard } from '../src/lib/source-actions';
import type { SourceWithStatus } from '../src/lib/types';

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

  it('keeps Imperial source links and its masters entry as peer actions', () => {
    const imperial = document.querySelector<HTMLElement>('[data-id="imperial-college-london"]')!;
    const actionGroup = imperial.querySelector<HTMLElement>('.source-actions')!;
    const expected = universities.find((university) => university.id === 'imperial-college-london')!;
    const directSourceLinks = [...actionGroup.children]
      .filter((child): child is HTMLAnchorElement => child.matches('a:not(.masters-course-action)'));

    expect(actionGroup.querySelector('details')).toBeNull();
    expect(directSourceLinks.map((link) => link.href)).toEqual(expected.sources.map((item) => item.url));
    expect([...actionGroup.children].filter((child) => child.matches('.masters-course-action'))).toHaveLength(1);
  });

  it('runs the real Manchester keyboard listener while preserving focus and all three exact sources', () => {
    const manchester = document.querySelector<HTMLElement>('[data-id="university-of-manchester"]')!;
    const actionGroup = manchester.querySelector<HTMLElement>('.source-actions')!;
    const details = actionGroup.querySelector<HTMLDetailsElement>(':scope > details.china-source-bundle')!;
    const summary = details.querySelector<HTMLElement>(':scope > summary')!;
    const expected = universities.find((university) => university.id === 'university-of-manchester')!.sources;

    expect([...actionGroup.children].map((child) => child.tagName)).toEqual(['DETAILS', 'A']);
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
    bindChinaSourceDetailsKeyboard(document);

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
  });
});

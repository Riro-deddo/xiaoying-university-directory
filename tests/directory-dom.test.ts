import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { loadUniversities } from '../src/lib/data';
import {
  applyDirectoryRows,
  bindDirectorySortButtons,
  sortInitialDirectoryUniversities,
} from '../src/lib/directory-dom';
import { createUniversitySearch } from '../src/lib/search';
import type { DirectorySort } from '../src/lib/types';

const universities = loadUniversities();
const directory = createUniversitySearch(universities);

function directoryDom() {
  const { document } = parseHTML(`
    <div id="university-list">
      ${universities.map((university) => `<article data-id="${university.id}"></article>`).join('')}
    </div>
    <button data-sort="qs" aria-pressed="true">QS</button>
    <button data-sort="the" aria-pressed="false">THE</button>
    <button data-sort="name" aria-pressed="false">院校名称</button>
  `);
  const list = document.querySelector<HTMLElement>('#university-list')!;
  const rows = [...list.querySelectorAll<HTMLElement>('article')];
  return {
    document,
    list,
    rows,
    rowsById: new Map(rows.map((row) => [row.dataset.id!, row])),
    buttons: [...document.querySelectorAll<HTMLButtonElement>('[data-sort]')],
  };
}

function ids(rows: Element[]): string[] {
  return rows.map((row) => row.getAttribute('data-id')!);
}

describe('directory DOM ordering', () => {
  it('uses the QS comparator for the stable initial render and keeps LBS last', () => {
    const initial = sortInitialDirectoryUniversities(universities);
    const expected = directory.search('', [], 'qs');

    expect(initial.map((university) => university.id)).toEqual(expected.map((university) => university.id));
    expect(initial).toHaveLength(94);
    expect(new Set(initial.map((university) => university.id)).size).toBe(94);
    expect(initial.at(-1)?.id).toBe('london-business-school');
    expect(universities.map((university) => university.id)).not.toEqual(initial.map((university) => university.id));
  });

  it.each<DirectorySort>(['qs', 'the', 'name'])('matches search order for the %s sort without losing or duplicating rows', (sortBy) => {
    const dom = directoryDom();
    const matches = directory.search('', [], sortBy);

    applyDirectoryRows(dom.list, dom.rowsById, matches);

    const rendered = [...dom.list.querySelectorAll('article')];
    expect(ids(rendered)).toEqual(matches.map((university) => university.id));
    expect(rendered).toHaveLength(94);
    expect(new Set(ids(rendered)).size).toBe(94);
  });

  it('applies search, state filter, and sort to both visible membership and DOM order', () => {
    const dom = directoryDom();
    const matches = directory.search('LBS', ['not-public'], 'the');

    applyDirectoryRows(dom.list, dom.rowsById, matches);

    const rendered = [...dom.list.querySelectorAll<HTMLElement>('article')];
    const visible = rendered.filter((row) => !row.hidden);
    const hidden = rendered.filter((row) => row.hidden);
    expect(ids(visible)).toEqual(matches.map((university) => university.id));
    expect(ids(visible)).toEqual(['london-business-school']);
    expect(hidden).toHaveLength(93);
    expect(rendered).toHaveLength(94);
    expect(new Set(ids(rendered)).size).toBe(94);
  });

  it('keeps sort aria state mutually exclusive and dispatches the clicked sort', () => {
    const dom = directoryDom();
    const selected: DirectorySort[] = [];
    bindDirectorySortButtons(dom.buttons, (sortBy) => selected.push(sortBy));

    dom.buttons[1].click();
    expect(selected).toEqual(['the']);
    expect(dom.buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);

    dom.buttons[2].click();
    expect(selected).toEqual(['the', 'name']);
    expect(dom.buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
  });
});

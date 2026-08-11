import { compareDirectoryUniversities } from './search';
import type { DirectorySort, UniversityWithStatus } from './types';

const directorySorts: DirectorySort[] = ['qs', 'the', 'name'];

export function sortInitialDirectoryUniversities<T extends UniversityWithStatus>(
  universities: T[],
): T[] {
  return [...universities].sort((left, right) => compareDirectoryUniversities(left, right, 'qs'));
}

export function applyDirectoryRows(
  list: HTMLElement | null,
  rowsById: ReadonlyMap<string, HTMLElement>,
  matches: Array<Pick<UniversityWithStatus, 'id'>>,
): void {
  const visibleIds = new Set(matches.map((university) => university.id));
  const orderedRows = matches.flatMap((university) => {
    const row = rowsById.get(university.id);
    return row ? [row] : [];
  });

  list?.append(...orderedRows);
  rowsById.forEach((row, id) => {
    row.hidden = !visibleIds.has(id);
  });
}

export function bindDirectorySortButtons(
  buttons: HTMLButtonElement[],
  onSort: (sortBy: DirectorySort) => void,
): void {
  buttons.forEach((button) => button.addEventListener('click', () => {
    const sortBy = button.dataset.sort as DirectorySort | undefined;
    if (!sortBy || !directorySorts.includes(sortBy)) return;

    buttons.forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    onSort(sortBy);
  }));
}

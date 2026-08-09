import { describe, expect, it } from 'vitest';
import { inspectInitialHtml, inspectProductionInitialHtml } from '../scripts/check-initial-html.mjs';

const directoryOptions = {
  expectedDirectoryCount: 101,
  expectedFirstIds: ['imperial-college-london', 'university-of-oxford', 'university-of-cambridge'],
  expectedLastId: 'institute-of-cancer-research-london',
};

describe('initial HTML payload guard', () => {
  it('rejects an inline institution registry or reverse index while keeping static URLs', () => {
    expect(() => inspectInitialHtml('<script>{"institutions":[{"nameZh":"北京大学"}],"evidenceState":"official-match"}</script>', ['北京大学', '清华大学']))
      .toThrow(/institution registry|reverse index/i);
  });

  it('accepts metadata-only HTML with separate static JSON URLs', () => {
    expect(inspectInitialHtml('<div data-list-url="/generated/lists/ucl-china.json"></div><script>{"institutionRegistryUrl":"/generated/institutions.json","reverseIndexUrl":"/generated/reverse-index.json"}</script>', ['北京大学', '清华大学']))
      .toMatchObject({ listPanelMetadata: 1, inlineRegistry: false, inlineReverseIndex: false });
  });

  it('accepts compact joined ranking fields without requiring the full ranking dataset inline', () => {
    const html = '<script>{"universities":[{"id":"oxford","rankings":{"qs":{"displayRank":"4"},"the":{"displayRank":"1"}}}],"universityDirectoryUrl":"/generated/universities.json","institutionRegistryUrl":"/generated/institutions.json","reverseIndexUrl":"/generated/reverse-index.json"}</script>';
    expect(inspectInitialHtml(html, ['北京大学', '清华大学']))
      .toMatchObject({ inlineRegistry: false, inlineReverseIndex: false });
    expect(html).not.toContain('"releases"');
  });

  it('accepts exactly 101 unique QS-sorted SSR rows with the approved specialists last', () => {
    const ids = [
      ...directoryOptions.expectedFirstIds,
      ...Array.from({ length: 97 }, (_, index) => `university-${index}`),
      directoryOptions.expectedLastId,
    ];
    const html = `${ids.map((id) => `<article class="university-row" data-id="${id}"></article>`).join('')}<script>{"institutionRegistryUrl":"/generated/institutions.json","reverseIndexUrl":"/generated/reverse-index.json"}</script>`;

    expect(inspectProductionInitialHtml(html, [])).toMatchObject({
      universityRows: 101,
      uniqueUniversityRows: 101,
      firstUniversityIds: directoryOptions.expectedFirstIds,
      lastUniversityId: directoryOptions.expectedLastId,
    });
  });

  it('rejects the old 96-row production directory', () => {
    const ids = [
      ...directoryOptions.expectedFirstIds,
      ...Array.from({ length: 92 }, (_, index) => `university-${index}`),
      directoryOptions.expectedLastId,
    ];
    const html = `${ids.map((id) => `<article class="university-row" data-id="${id}"></article>`).join('')}<script>{"institutionRegistryUrl":"/generated/institutions.json","reverseIndexUrl":"/generated/reverse-index.json"}</script>`;

    expect(() => inspectProductionInitialHtml(html, [])).toThrow(/101/);
  });

  it('rejects duplicated or incorrectly placed initial university rows', () => {
    const duplicateHtml = `${Array.from({ length: 101 }, () => '<article class="university-row" data-id="duplicate"></article>').join('')}<script>{"institutionRegistryUrl":"/generated/institutions.json","reverseIndexUrl":"/generated/reverse-index.json"}</script>`;
    expect(() => inspectInitialHtml(duplicateHtml, [], directoryOptions)).toThrow(/unique/i);

    const wrongLastIds = [
      ...directoryOptions.expectedFirstIds,
      ...Array.from({ length: 97 }, (_, index) => `university-${index}`),
      'not-icr',
    ];
    const wrongLastHtml = `${wrongLastIds.map((id) => `<article class="university-row" data-id="${id}"></article>`).join('')}<script>{"institutionRegistryUrl":"/generated/institutions.json","reverseIndexUrl":"/generated/reverse-index.json"}</script>`;
    expect(() => inspectInitialHtml(wrongLastHtml, [], directoryOptions)).toThrow(/last/i);
  });
});

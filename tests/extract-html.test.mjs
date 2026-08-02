import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { extractHtmlFacts } from '../scripts/extractors/html.mjs';
import { normalizeExtractedFact } from '../scripts/extractors/normalize.mjs';

const tableFixture = await readFile(new URL('./fixtures/sources/html-table.html', import.meta.url), 'utf8');
const listFixture = await readFile(new URL('./fixtures/sources/html-list.html', import.meta.url), 'utf8');

describe('extractHtmlFacts', () => {
  it('extracts only registered table columns', async () => {
    const facts = await extractHtmlFacts({
      mode: 'html-table',
      rowSelector: '#china-list tbody tr',
      institutionColumn: 0,
      tierColumn: 1,
      scoreColumn: 2,
    }, tableFixture);

    expect(facts).toEqual([
      { institutionOfficial: '示例大学', tierOfficial: 'Band A', scoreOfficial: '80%' },
    ]);
  });

  it('does not let nested table cells shift registered columns', async () => {
    const facts = await extractHtmlFacts({
      mode: 'html-table',
      rowSelector: '#nested-list tbody > tr',
      institutionColumn: 1,
      tierColumn: 2,
      scoreColumn: 3,
    }, tableFixture);

    expect(facts).toEqual([
      { institutionOfficial: 'Example University', tierOfficial: 'Band B', scoreOfficial: '75%' },
    ]);
  });

  it('extracts direct entries from the registered list only', async () => {
    await expect(extractHtmlFacts({ mode: 'html-list', selector: '#official-list' }, listFixture))
      .resolves.toEqual([{ institutionOfficial: 'Example University' }]);
  });

  it('does not treat unrelated navigation text as a list', async () => {
    await expect(extractHtmlFacts({ mode: 'html-list', selector: '#requirements' }, listFixture))
      .resolves.toEqual([]);
  });
});

describe('normalizeExtractedFact', () => {
  it('normalizes text without translating official tier or score values', () => {
    expect(normalizeExtractedFact({
      institutionOfficial: '  示例　大学  ',
      tierOfficial: ' Group　１ ',
      scoreOfficial: ' ８０％ ',
    }, {})).toEqual({
      institutionOfficial: '示例 大学',
      tierOfficial: 'Group 1',
      scoreOfficial: '80%',
    });
  });
});

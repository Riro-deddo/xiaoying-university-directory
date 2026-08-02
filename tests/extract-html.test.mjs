import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { extractHtmlFacts } from '../scripts/extractors/html.mjs';
import { normalizeExtractedFact } from '../scripts/extractors/normalize.mjs';

const tableFixture = await readFile(new URL('./fixtures/sources/html-table.html', import.meta.url), 'utf8');
const listFixture = await readFile(new URL('./fixtures/sources/html-list.html', import.meta.url), 'utf8');
const groupedFixture = await readFile(new URL('./fixtures/sources/html-grouped-lists.html', import.meta.url), 'utf8');
const bilingualTableFixture = await readFile(new URL('./fixtures/sources/html-bilingual-table.html', import.meta.url), 'utf8');

const bilingualInstitutionPattern = '^(?<institutionOfficial>.+?)\\s+(?<institutionNameZh>[\\u3400-\\u9fff].+)$';

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

  it('extracts Cambridge sibling lists using only registered group containers', async () => {
    await expect(extractHtmlFacts({
      mode: 'html-grouped-items',
      groups: [
        { selector: '#China .group-a', tierOfficial: 'Group A' },
        { selector: '#China .group-b', tierOfficial: 'Group B' },
      ],
      itemSelector: 'li',
    }, groupedFixture)).resolves.toEqual([
      { institutionOfficial: 'Peking University', tierOfficial: 'Group A' },
      { institutionOfficial: 'Tsinghua University', tierOfficial: 'Group A' },
      { institutionOfficial: 'Fudan University', tierOfficial: 'Group B' },
    ]);
  });

  it('uses registered Warwick table boundaries and splits institutions at breaks before normalising text', async () => {
    await expect(extractHtmlFacts({
      mode: 'html-table',
      tableIndex: 3,
      rowSelector: 'tbody tr',
      institutionColumn: 0,
      defaultTierOfficial: 'Postgraduate',
      scoreColumn: 1,
      splitOnBreaks: true,
    }, bilingualTableFixture)).resolves.toEqual([
      { institutionOfficial: 'Beihang University', scoreOfficial: '75%' },
      { institutionOfficial: 'Fudan University', scoreOfficial: '75%' },
    ]);
  });

  it('extracts Nottingham bilingual paragraphs from a configured tier cell', async () => {
    await expect(extractHtmlFacts({
      mode: 'html-table',
      rowSelector: '#nottingham-taught tbody tr',
      institutionColumn: 1,
      tierColumn: 0,
      itemSelector: 'p',
      institutionPattern: bilingualInstitutionPattern,
    }, bilingualTableFixture)).resolves.toEqual([
      { institutionOfficial: 'Fudan University', institutionNameZh: '复旦大学', tierOfficial: 'Tier 1' },
      { institutionOfficial: 'Shanghai Jiao Tong University', institutionNameZh: '上海交通大学', tierOfficial: 'Tier 1' },
    ]);
  });

  it('extracts Southampton accordion items with registered tier buttons', async () => {
    await expect(extractHtmlFacts({
      mode: 'html-grouped-items',
      groups: [{ selector: '#tiers section.accordion-item', tierSelector: 'button' }],
      itemSelector: '.copy ul > li',
      institutionPattern: bilingualInstitutionPattern,
    }, groupedFixture)).resolves.toEqual([
      { institutionOfficial: 'Zhejiang University', institutionNameZh: '浙江大学', tierOfficial: 'Tier 1' },
      { institutionOfficial: 'Nanjing University', institutionNameZh: '南京大学', tierOfficial: 'Tier 2' },
    ]);
  });

  it('extracts Bristol accepted institutions from the configured one-column table', async () => {
    await expect(extractHtmlFacts({
      mode: 'html-table',
      rowSelector: '#bristol tbody tr',
      institutionColumn: 0,
    }, bilingualTableFixture)).resolves.toEqual([
      { institutionOfficial: 'University of Science and Technology of China' },
    ]);
  });

  it('extracts Sheffield bilingual names and combines configured score columns', async () => {
    await expect(extractHtmlFacts({
      mode: 'html-table',
      rowSelector: '#sheffield tbody tr',
      institutionColumn: 0,
      nameZhColumn: 1,
      scoreColumns: [
        { label: '2:1', column: 2 },
        { label: '2:2', column: 3 },
      ],
      tierColumn: 4,
    }, bilingualTableFixture)).resolves.toEqual([
      {
        institutionOfficial: 'Beihang University',
        institutionNameZh: '北京航空航天大学',
        tierOfficial: 'Tier A',
        scoreOfficial: '2:1: 80%；2:2: 75%',
      },
    ]);
  });

  it.each([
    ['missing registered group', { mode: 'html-grouped-items', groups: [{ selector: '#missing', tierOfficial: 'Group A' }], itemSelector: 'li' }, groupedFixture],
    ['empty registered group', { mode: 'html-grouped-items', groups: [{ selector: '#China', tierOfficial: 'Group A' }], itemSelector: '.missing-item' }, groupedFixture],
    ['missing registered table column', { mode: 'html-table', rowSelector: '#bristol tbody tr', institutionColumn: 0, nameZhColumn: 4 }, bilingualTableFixture],
  ])('rejects %s with a parser-structure error', async (_label, config, fixture) => {
    await expect(extractHtmlFacts(config, fixture)).rejects.toMatchObject({ code: 'PARSER_STRUCTURE' });
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

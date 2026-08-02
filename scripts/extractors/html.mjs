import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

class ParserStructureError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ParserStructureError';
    this.code = 'PARSER_STRUCTURE';
  }
}

function readRegisteredSelector(html, selector) {
  const { document } = parseHTML(html);
  const registered = document.querySelector(selector);
  if (registered) return registered;

  const { document: articleDocument } = parseHTML(html);
  const article = new Readability(articleDocument).parse();
  if (!article?.content) return undefined;
  return parseHTML(article.content).document.querySelector(selector);
}

function textAt(cells, column) {
  if (!Number.isInteger(column) || !cells[column]) return undefined;
  return cells[column].textContent.trim();
}

function requiredTextAt(cells, column, description) {
  const value = textAt(cells, column);
  if (value === undefined) throw new ParserStructureError(`Missing configured ${description} column ${column}`);
  return value;
}

function assertConfiguredTableColumns(cells, config) {
  const institutionColumns = config.institutionColumns ?? [config.institutionColumn];
  const configuredColumns = [
    ...institutionColumns.map((column) => ({ column, description: 'institution' })),
    { column: config.tierColumn, description: 'tier' },
    { column: config.nameZhColumn, description: 'Chinese institution name' },
    { column: config.scoreColumn, description: 'score' },
    ...(config.scoreColumns ?? []).map(({ column }) => ({ column, description: 'score' })),
  ].filter(({ column }) => Number.isInteger(column));

  for (const { column, description } of configuredColumns) {
    if (!cells[column]) throw new ParserStructureError(`Missing configured ${description} column ${column}`);
  }
}

function textWithBreakBoundaries(element) {
  const copy = element.cloneNode(true);
  for (const breakElement of copy.querySelectorAll('br')) {
    breakElement.replaceWith(copy.ownerDocument.createTextNode('\n'));
  }
  return copy.textContent;
}

function extractInstitution(text, config) {
  const value = text.trim();
  if (!value) return undefined;
  if (!config.institutionPattern) return { institutionOfficial: value };

  const match = new RegExp(config.institutionPattern, 'u').exec(value);
  const institutionOfficial = match?.groups?.institutionOfficial?.trim();
  if (!institutionOfficial) {
    throw new ParserStructureError(`Configured institution pattern did not match: ${value}`);
  }
  const fact = { institutionOfficial };
  const institutionNameZh = match.groups.institutionNameZh?.trim();
  if (institutionNameZh) fact.institutionNameZh = institutionNameZh;
  return fact;
}

function institutionFactsInCell(cell, config) {
  const elements = config.itemSelector ? Array.from(cell.querySelectorAll(config.itemSelector)) : [cell];
  if (config.itemSelector && elements.length === 0) {
    throw new ParserStructureError(`Missing configured item selector: ${config.itemSelector}`);
  }

  return elements.flatMap((element) => {
    const text = textWithBreakBoundaries(element);
    const entries = config.splitOnBreaks ? text.split('\n') : [text];
    return entries.map((entry) => extractInstitution(entry, config)).filter(Boolean);
  });
}

function outermostRows(rows) {
  return rows.filter((row) => !rows.some((candidate) => candidate !== row && candidate.contains(row)));
}

function tableRows(document, config) {
  if (!config.rowSelector) return [];
  if (!Number.isInteger(config.tableIndex)) {
    return outermostRows(Array.from(document.querySelectorAll(config.rowSelector)));
  }

  const table = document.querySelectorAll('table')[config.tableIndex];
  if (!table) throw new ParserStructureError(`Missing configured table index ${config.tableIndex}`);
  return outermostRows(Array.from(table.querySelectorAll(config.rowSelector)));
}

function extractTableFacts(config, html) {
  if (!Number.isInteger(config.institutionColumn) && !Array.isArray(config.institutionColumns)) return [];
  const { document } = parseHTML(html);
  return tableRows(document, config).flatMap((row) => {
    const cells = Array.from(row.children)
      .filter((element) => element.localName === 'th' || element.localName === 'td');
    assertConfiguredTableColumns(cells, config);
    const columns = config.institutionColumns ?? [config.institutionColumn];
    return columns.flatMap((column) => {
      const institutionCell = cells[column];
      if (!institutionCell) throw new ParserStructureError(`Missing configured institution column ${column}`);
      const tierOfficial = textAt(cells, config.tierColumn);
      const institutionNameZh = Number.isInteger(config.nameZhColumn)
        ? requiredTextAt(cells, config.nameZhColumn, 'Chinese institution name')
        : undefined;
      const scoreOfficial = Array.isArray(config.scoreColumns)
        ? config.scoreColumns.map(({ label, column: scoreColumn }) => (
          `${label}: ${requiredTextAt(cells, scoreColumn, 'score')}`
        )).join('；')
        : textAt(cells, config.scoreColumn);

      return institutionFactsInCell(institutionCell, config).map((fact) => ({
        ...fact,
        ...(institutionNameZh ? { institutionNameZh } : {}),
        ...(tierOfficial !== undefined ? { tierOfficial } : {}),
        ...(scoreOfficial !== undefined ? { scoreOfficial } : {}),
      }));
    });
  });
}

function extractGroupedItemFacts(config, html) {
  if (!Array.isArray(config.groups) || config.groups.length === 0 || !config.itemSelector) return [];
  const { document } = parseHTML(html);
  return config.groups.flatMap((group) => {
    const containers = Array.from(document.querySelectorAll(group.selector));
    if (containers.length === 0) throw new ParserStructureError(`Missing configured group container: ${group.selector}`);
    return containers.flatMap((container) => {
      const tierOfficial = group.tierOfficial ?? container.querySelector(group.tierSelector)?.textContent.trim();
      if (!tierOfficial) throw new ParserStructureError(`Missing configured group tier for: ${group.selector}`);
      const items = Array.from(container.querySelectorAll(config.itemSelector));
      if (items.length === 0) throw new ParserStructureError(`Configured group is empty: ${group.selector}`);
      return items.map((item) => extractInstitution(textWithBreakBoundaries(item), config))
        .filter(Boolean)
        .map((fact) => ({ ...fact, tierOfficial }));
    });
  });
}

export async function extractHtmlFacts(config, html) {
  if (config.mode === 'html-table') {
    return extractTableFacts(config, html);
  }

  if (config.mode === 'html-list') {
    if (!config.selector) return [];
    const list = readRegisteredSelector(html, config.selector);
    if (!list) return [];
    return Array.from(list.children)
      .filter((element) => element.localName === 'li')
      .map((element) => element.textContent.trim())
      .filter(Boolean)
      .map((institutionOfficial) => ({ institutionOfficial }));
  }

  if (config.mode === 'html-grouped-items') return extractGroupedItemFacts(config, html);

  return [];
}

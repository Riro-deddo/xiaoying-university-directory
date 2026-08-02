import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

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

export async function extractHtmlFacts(config, html) {
  if (config.mode === 'html-table') {
    if (!config.rowSelector || (!Number.isInteger(config.institutionColumn) && !Array.isArray(config.institutionColumns))) return [];
    const { document } = parseHTML(html);
    return Array.from(document.querySelectorAll(config.rowSelector)).flatMap((row) => {
      const cells = Array.from(row.children)
        .filter((element) => element.localName === 'th' || element.localName === 'td');
      const columns = config.institutionColumns ?? [config.institutionColumn];
      return columns.flatMap((column) => {
        const institutionOfficial = textAt(cells, column);
        if (!institutionOfficial) return [];
        const fact = { institutionOfficial };
        const tierOfficial = textAt(cells, config.tierColumn);
        const scoreOfficial = textAt(cells, config.scoreColumn);
        if (tierOfficial !== undefined) fact.tierOfficial = tierOfficial;
        if (scoreOfficial !== undefined) fact.scoreOfficial = scoreOfficial;
        return [fact];
      });
    });
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

  return [];
}

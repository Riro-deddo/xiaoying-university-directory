import { parseHTML } from 'linkedom';

function normalizeIdentityText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase('en-US');
}

function textWithElementBoundaries(node) {
  if (node.nodeType === 3) return node.textContent ?? '';
  return [...(node.childNodes ?? [])]
    .map((child) => textWithElementBoundaries(child))
    .join(' ');
}

function hasExplicitlyHiddenStyle(element) {
  return (element.getAttribute('style') ?? '').split(';').some((declaration) => {
    const separator = declaration.indexOf(':');
    if (separator < 0) return false;
    const property = declaration.slice(0, separator).trim().toLocaleLowerCase('en-US');
    const value = declaration.slice(separator + 1)
      .replace(/\s*!important\s*$/iu, '')
      .trim()
      .toLocaleLowerCase('en-US');
    return property === 'display' && value === 'none'
      || property === 'visibility' && value === 'hidden';
  });
}

function isExplicitlyHidden(element) {
  return element.hasAttribute('hidden')
    || element.hasAttribute('inert')
    || element.getAttribute('aria-hidden')?.trim().toLocaleLowerCase('en-US') === 'true'
    || hasExplicitlyHiddenStyle(element);
}

function identityDocument(source) {
  if (/<html(?:\s|>)/iu.test(source)) return parseHTML(source).document;
  if (/<body(?:\s|>)/iu.test(source)) return parseHTML(`<html>${source}</html>`).document;
  return parseHTML(`<html><body>${source}</body></html>`).document;
}

function visiblePageText(html) {
  const source = String(html ?? '');
  try {
    const document = identityDocument(source);
    for (const element of document.querySelectorAll('head, title, base, meta, link')) {
      element.remove();
    }
    const body = document.body;
    if (!body) return '';
    if (isExplicitlyHidden(document.documentElement) || isExplicitlyHidden(body)) return '';
    for (const element of body.querySelectorAll('script, style, template, noscript')) {
      element.remove();
    }
    for (const element of body.querySelectorAll('[hidden], [inert]')) element.remove();
    for (const element of body.querySelectorAll('[aria-hidden]')) {
      if (element.getAttribute('aria-hidden')?.trim().toLocaleLowerCase('en-US') === 'true') {
        element.remove();
      }
    }
    for (const element of body.querySelectorAll('[style]')) {
      if (hasExplicitlyHiddenStyle(element)) element.remove();
    }
    return `${body.textContent ?? ''} ${textWithElementBoundaries(body)}`;
  } catch {
    return '';
  }
}

export function missingRequiredText(html, requiredText) {
  const normalizedPageText = normalizeIdentityText(visiblePageText(html));
  return requiredText.filter((required) => (
    !normalizedPageText.includes(normalizeIdentityText(required))
  ));
}

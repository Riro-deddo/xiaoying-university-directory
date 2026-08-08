import { createHash } from 'node:crypto';

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function sourceContentKind(response, sourceUrl, expectedKind) {
  if (expectedKind) return expectedKind;
  const contentType = response.headers.get('content-type')?.toLocaleLowerCase('en-US') ?? '';
  return contentType.includes('pdf') || String(sourceUrl).toLocaleLowerCase('en-US').includes('.pdf')
    ? 'pdf'
    : 'html';
}

export async function readAndHashSourceContent(response, sourceUrl, expectedKind) {
  const kind = sourceContentKind(response, sourceUrl, expectedKind);
  if (kind === 'pdf') {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { kind, bytes, contentHash: sha256(bytes) };
  }
  const text = await response.text();
  return { kind, text, contentHash: sha256(text) };
}

import { describe, expect, it } from 'vitest';
import { readAndHashSourceContent } from '../scripts/source-content-hash.mjs';

function utf8Bytes(text, withBom = false) {
  const encoded = new TextEncoder().encode(text);
  return withBom ? new Uint8Array([0xef, 0xbb, 0xbf, ...encoded]) : encoded;
}

describe('source content hashing', () => {
  it.each([
    { name: 'ordinary HTML', withBom: false },
    { name: 'UTF-8 BOM HTML', withBom: true },
  ])('hashes $name exactly as Fetch response.text() decodes it', async ({ withBom }) => {
    const html = '<html>plain</html>';
    const result = await readAndHashSourceContent(new Response(utf8Bytes(html, withBom), {
      headers: { 'content-type': 'text/html' },
    }), 'https://example.test/source');

    expect(result).toEqual({
      kind: 'html',
      text: html,
      contentHash: '567a1218edfef2f8443a6dbd2b830620662a56858d7b45a94fb4bb52f458f810',
    });
  });

  it('hashes PDF bytes without collapsing distinct invalid UTF-8 sequences', async () => {
    const invalidByte = await readAndHashSourceContent(new Response(new Uint8Array([0xff]), {
      headers: { 'content-type': 'application/pdf' },
    }), 'https://example.test/source.pdf');
    const encodedReplacementCharacter = await readAndHashSourceContent(new Response(new Uint8Array([0xef, 0xbf, 0xbd]), {
      headers: { 'content-type': 'application/pdf' },
    }), 'https://example.test/source.pdf');

    expect(invalidByte.kind).toBe('pdf');
    expect(encodedReplacementCharacter.kind).toBe('pdf');
    expect(invalidByte.bytes).toEqual(new Uint8Array([0xff]));
    expect(encodedReplacementCharacter.bytes).toEqual(new Uint8Array([0xef, 0xbf, 0xbd]));
    expect(invalidByte.contentHash).not.toBe(encodedReplacementCharacter.contentHash);
  });
});

import { describe, expect, it } from 'vitest';
import { inspectInitialHtml } from '../scripts/check-initial-html.mjs';

describe('initial HTML payload guard', () => {
  it('rejects an inline institution registry or reverse index while keeping static URLs', () => {
    expect(() => inspectInitialHtml('<script>{"institutions":[{"nameZh":"北京大学"}],"evidenceState":"official-match"}</script>', ['北京大学', '清华大学']))
      .toThrow(/institution registry|reverse index/i);
  });

  it('accepts metadata-only HTML with separate static JSON URLs', () => {
    expect(inspectInitialHtml('<div data-list-url="/generated/lists/ucl-china.json"></div><script>{"institutionRegistryUrl":"/generated/institutions.json","reverseIndexUrl":"/generated/reverse-index.json"}</script>', ['北京大学', '清华大学']))
      .toMatchObject({ listPanelMetadata: 1, inlineRegistry: false, inlineReverseIndex: false });
  });
});

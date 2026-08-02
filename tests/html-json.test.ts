import { describe, expect, it } from 'vitest';
import { serializeJsonForHtml } from '../src/lib/html-json';

describe('serializeJsonForHtml', () => {
  it('round-trips data without allowing script termination or raw line separators', () => {
    const value = { text: '</script><script>alert(1)</script>\u2028next\u2029line' };
    const serialized = serializeJsonForHtml(value);

    expect(serialized).not.toContain('<');
    expect(serialized).not.toContain('\u2028');
    expect(serialized).not.toContain('\u2029');
    expect(JSON.parse(serialized)).toEqual(value);
  });
});

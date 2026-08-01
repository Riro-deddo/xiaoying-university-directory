import { describe, expect, it } from 'vitest';
import { withBase } from '../src/lib/urls';

describe('withBase', () => {
  it('inserts one slash between a GitHub Pages base and a page path', () => {
    expect(withBase('/xiaoying-university-directory', 'methodology/')).toBe(
      '/xiaoying-university-directory/methodology/',
    );
  });

  it('keeps the root base valid during local development', () => {
    expect(withBase('/', 'favicon.svg')).toBe('/favicon.svg');
  });
});

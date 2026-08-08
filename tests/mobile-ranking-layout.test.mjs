import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const page = readFileSync(resolve(root, 'src/pages/index.astro'), 'utf8');
const styles = readFileSync(resolve(root, 'src/styles/global.css'), 'utf8');

describe('mobile ranking layout', () => {
  it('groups both overall rankings without changing their desktop columns', () => {
    expect(page).toMatch(/class="ranking-pills"[\s\S]*class="rank rank-qs"[\s\S]*class="rank rank-the"/);
    expect(styles).toContain('.ranking-pills{display:contents}');
    expect(styles).toContain('.rank-qs{grid-column:2}');
    expect(styles).toContain('.rank-the{grid-column:3}');
  });

  it('keeps long ranking bands out of the mobile name row', () => {
    expect(styles).toContain('@media(max-width:800px)');
    expect(styles).toContain('.university-row{grid-template-columns:minmax(0,1fr) auto;');
    expect(styles).toContain('.ranking-pills{grid-column:1/-1;grid-row:2;display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px}');
    expect(styles).not.toContain('.university-row{grid-template-columns:minmax(0,1fr) auto auto');
  });

  it('stacks status and rankings safely on narrow phones', () => {
    expect(styles).toContain('.ranking-pills{grid-row:3;justify-content:flex-start}');
    expect(styles).toContain('.specialist-detail{grid-row:4}');
  });
});

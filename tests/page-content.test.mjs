import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const page = readFileSync(resolve(root, 'src/pages/index.astro'), 'utf8');
const styles = readFileSync(resolve(root, 'src/styles/global.css'), 'utf8');

describe('dual-direction search page', () => {
  it('exposes both accessible mode tabs and preserves the UK directory controls', () => {
    expect(page).toContain('data-search-mode="uk-university"');
    expect(page).toContain('查英国大学');
    expect(page).toContain('data-search-mode="chinese-institution"');
    expect(page).toContain('查中国本科院校');
    expect(page).toMatch(/aria-pressed=/);
    expect(page).toContain('id="university-list"');
    expect(page).toContain('id="institution-chooser"');
  });

  it('includes live announcements, official evidence metadata, and responsive card layout', () => {
    expect(page).toContain('aria-live="polite"');
    expect(page).toContain('官方来源');
    expect(page).toContain('最近成功检查');
    expect(styles).toContain('.evidence-card');
    expect(styles).toContain('@media(max-width:760px)');
  });

  it('contains no eligibility language in page or client search code', () => {
    const search = readFileSync(resolve(root, 'src/lib/search.ts'), 'utf8');
    expect(`${page}${search}`).not.toMatch(/可以申请|不能申请|保底|冲刺/);
  });
});

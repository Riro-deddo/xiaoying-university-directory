import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const page = readFileSync(resolve(root, 'src/pages/index.astro'), 'utf8');
const methodology = readFileSync(resolve(root, 'src/pages/methodology.astro'), 'utf8');
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
const contributing = readFileSync(resolve(root, 'CONTRIBUTING.md'), 'utf8');
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

  it('describes the directory as Chinese institution rules rather than one universal List type', () => {
    expect(page).toContain('英国大学中国院校规则，一页查清');
    expect(page).not.toContain('英国大学官方 List，一页查清');
  });

  it('labels institution rules by meaning instead of treating every source as an eligibility List', () => {
    expect(page).toContain('<details class="official-list-panel">');
    expect(page).toContain('officialPanelTitle(panel.ruleType, panel.rows.length)');
    expect(page).toContain('panel.ruleSummaryZh');
    expect(page).toContain('panel.listedMeaningZh');
    expect(page).toContain('panel.unlistedMeaningZh');
    expect(page).toContain("panel.scope !== 'university'");
    expect(page).toContain('仅适用于：');
    expect(page).toContain('官方分组/等级');
    expect(page).toContain('官网存在院校规则，但本站暂未完成安全结构化');
    expect(page).not.toContain('查看已收录院校 List（');
    expect(page).not.toContain('不能申请');
    expect(styles).toContain('.official-rule-meaning');
    expect(styles).toContain('.rule-type');
  });
});

describe('published methodology and contributor guidance', () => {
  it('discloses automated extraction, evidence limits, and freshness semantics', () => {
    expect(methodology).toContain('自动提取');
    expect(methodology).toContain('不代表不能申请');
    expect(methodology).toContain('最近成功检查');
    expect(methodology).toContain('部分学院');
    expect(methodology).toContain('上一版可信数据');
  });

  it('states the full cohort, daily automation, and zero-paid-service boundary', () => {
    expect(readme).toContain('QS 2027 世界前 200');
    expect(readme).toContain('28 所');
    expect(readme).toContain('每天');
    expect(readme).toContain('不依赖付费 API');
  });

  it('documents the minimum safe source and alias contribution path', () => {
    for (const phrase of ['官方来源', '最小测试样本', '解析保护条件', '院校别名', 'pnpm test:run']) {
      expect(contributing).toContain(phrase);
    }
  });
});

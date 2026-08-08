import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const page = readFileSync(resolve(root, 'src/pages/index.astro'), 'utf8');
const methodology = readFileSync(resolve(root, 'src/pages/methodology.astro'), 'utf8');
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
const contributing = readFileSync(resolve(root, 'CONTRIBUTING.md'), 'utf8');
const styles = readFileSync(resolve(root, 'src/styles/global.css'), 'utf8');
const presentation = readFileSync(resolve(root, 'src/lib/presentation.ts'), 'utf8');
const sources = JSON.parse(readFileSync(resolve(root, 'src/data/sources.json'), 'utf8'));

describe('dual-direction search page', () => {
  it('explains the expanded directory and keeps the ranking editions distinct', () => {
    expect(page).toContain('QS 2027');
    expect(page).toContain('THE 2026');
    expect(page).toContain('排名仅作院校信息参考');
  });

  it('renders accessible QS, THE, and name sorts that reorder the real directory rows', () => {
    expect(page).toContain('aria-label="院校排序方式"');
    expect(page).toContain('data-sort={value}');
    expect(page).toContain("(['qs', 'the', 'name'] as const)");
    expect(page).toContain("let selectedSort: DirectorySort = 'qs'");
    expect(page).toContain("directory.search(input?.value ?? '', selected, selectedSort)");
    expect(page).toContain('applyDirectoryRows(list, rowsById, matches)');
    expect(page).toContain('bindDirectorySortButtons(sortButtons, (sortBy) => {');
  });

  it('renders six information groups while retaining China-rule evidence and folded lists', () => {
    for (const heading of ['大学', 'QS 2027', 'THE 2026', '中国规则状态', '范围', '来源 / 操作']) {
      expect(page).toContain(`<span>${heading}</span>`);
    }
    expect(page).toContain('rankingCopy(university.rankings.qs)');
    expect(page).toContain('rankingCopy(university.rankings.the)');
    expect(page).toContain('id="institution-search"');
    expect(page).toContain('official-list-panel');
  });

  it('pins each desktop information group to its matching grid column', () => {
    for (const declaration of [
      '.university-name{grid-column:1}', '.rank-qs{grid-column:2}', '.rank-the{grid-column:3}',
      '.state{grid-column:4}', '.scope{grid-column:5}', '.source-actions{grid-column:6;grid-row:1}',
    ]) {
      expect(styles).toContain(declaration);
    }
  });

  it('keeps LBS out of overall ranks and links its approved specialist reference', () => {
    expect(page).toContain("university.directoryCategory === 'specialist' ? '—'");
    expect(page).toContain('QS 2026 商业与管理全球第 9 · 专门商学院，不参与综合大学排序');
    expect(page).toContain('university.specialistRanking.sourceUrl');
    expect(page).toContain('特色院校');
  });

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

  it('states the complete QS directory plus one specialist scope and keeps the specialist rank-safe', () => {
    expect(page).toContain('{directoryScopeCopy}');
    expect(presentation).toContain("directoryScopeCopy = '93 所 QS 2027 英国院校 + 1 所特色院校'");
    expect(page).toContain('rankingCopy(university.rankings.qs)');
    expect(page).toContain('rankingCopy(university.rankings.the)');
    expect(page).not.toContain("university.qs?.rank ?? '—'");
  });

  it('labels institution rules by meaning instead of treating every source as an eligibility List', () => {
    expect(page).toContain('<details class="official-list-panel"');
    expect(page).toContain('officialPanelTitle(panel.ruleType, panel.recordCount)');
    expect(page).toContain('panel.ruleSummaryZh');
    expect(page).toContain('panel.listedMeaningZh');
    expect(page).toContain('panel.unlistedMeaningZh');
    expect(page).toContain("panel.scope !== 'university'");
    expect(page).toContain('仅适用于：');
    expect(page).toContain('官方分组/等级');
    expect(page).toContain('官网存在院校规则，但本站暂未完成安全结构化');
    expect(page).toContain('规则人工核验：');
    expect(page).toContain('查看规则说明来源');
    expect(page).not.toContain('查看已收录院校 List（');
    expect(page).not.toContain('不能申请');
    expect(styles).toContain('.official-rule-meaning');
    expect(styles).toContain('.rule-type');
  });

  it('defers list rows and reverse-index data until the relevant interaction', () => {
    expect(page).toContain('data-list-url={panel.dataUrl}');
    expect(page).toContain("fetch(panel.dataset.listUrl");
    expect(page).toContain("import { fetchInstitutionSearchData } from '../lib/lazy-institution-data'");
    expect(page).toContain('fetchInstitutionSearchData(');
    expect(page).not.toContain("import reverseIndex from '../data/generated/reverse-index.json'");
    expect(page).not.toContain('panel.rows.map');
  });

  it('defers the institution registry with the reverse index until Chinese-institution mode', () => {
    expect(page).toContain("institutionRegistryUrl: withBase(base, 'generated/institutions.json')");
    expect(page).not.toContain('const searchData = { institutions,');
    expect(page).toContain('(url) => fetch(url, { cache: \'force-cache\' })');
    expect(page).toContain('reverseIndexLoading = undefined; update();');
    expect(page).toContain('institutionDirectory = undefined;');
  });

  it('offers a visible accessible retry for failed Chinese-institution data loading', () => {
    expect(page).toContain('id="institution-retry"');
    expect(page).toContain('重新加载中国院校查询数据');
    expect(page).toContain("institutionRetry?.addEventListener('click', () => {");
    expect(page).toContain('void loadInstitutionDirectory();');
  });

  it('uses the complete QS directory scope in all reverse-search copy', () => {
    expect(page).toContain('directoryScopeCopy');
    expect(presentation).toContain("directoryScopeCopy = '93 所 QS 2027 英国院校 + 1 所特色院校'");
    expect(page).not.toContain('查看 28 所英国大学的公开信息');
    expect(page).not.toContain('28 所英国大学的公开信息');
  });

  it('keeps the reviewed Manchester and Exeter source copy safe for the later card rendering', () => {
    const manchesterSources = [
      'manchester-china',
      'manchester-computer-science-china',
      'manchester-law-china',
    ].map((id) => sources.find((source) => source.id === id));
    expect(manchesterSources.map((source) => source?.institutionRule.summaryZh).join(' '))
      .toContain('完整名单未公开');
    expect(manchesterSources.map((source) => source?.institutionRule.summaryZh).join(' '))
      .not.toMatch(/法学.*公开.*名单/u);
    expect(sources.find((source) => source.id === 'exeter-china')?.institutionRule.summaryZh).toContain('取消原有国内大学排名要求');
  });

  it('renders reviewed rule-only detail before the official links', () => {
    expect(page).toContain('本科院校会影响要求，完整名单未公开');
    expect(sources.find((source) => source.id === 'exeter-china')?.institutionRule.summaryZh).toContain('取消原有国内大学排名要求');
    expect(page.indexOf('university-rule-summary')).toBeLessThan(page.indexOf('source-actions'));
  });
});

describe('published methodology and contributor guidance', () => {
  it('explains ranking scope, date meanings, and the non-destructive review boundary in plain Chinese', () => {
    for (const phrase of [
      'QS 2027 中出现的全部英国院校（93 所）',
      'THE 2026 只作同校辅助展示',
      '未进入 QS 主目录',
      '排名年份',
      '内容更新时间',
      '来源检查时间',
      '不等于规则已经由人工改写',
      '排名只作信息参考，不决定申请资格',
      '学校、学院、具体项目官网与招生部门',
      'QS 2026 商业与管理第 9',
      '不是综合大学排名',
      '不调用付费 API',
      '不自动改写已接受的中国规则摘要',
      '待审核',
    ]) expect(methodology).toContain(phrase);

    for (const phrase of [
      '年度排名快照',
      'pnpm test:run',
      'pnpm build',
      'pnpm sync:sources',
      '不需要个人电脑 24 小时开机',
    ]) expect(readme).toContain(phrase);
  });

  it('limits daily review to source observations and keeps acceptance manual', () => {
    const dailyMethodology = methodology.slice(
      methodology.indexOf('<h2>怎样自动更新</h2>'),
      methodology.indexOf('<h2>时间字段</h2>'),
    );
    expect(dailyMethodology).toContain('页面内容变化或访问异常时，会进入待审核');
    expect(dailyMethodology).toContain('不自动改写已接受的中国规则摘要');
    expect(dailyMethodology).not.toContain('关键规则文字');
    expect(dailyMethodology).not.toContain('自动提取');
  });

  it('discloses evidence limits and freshness semantics', () => {
    expect(methodology).toContain('不代表不能申请');
    expect(methodology).toContain('最近成功检查');
    expect(methodology).toContain('部分学院');
    expect(methodology).toContain('上一版可信数据');
  });

  it('states the full cohort, daily automation, and zero-paid-service boundary', () => {
    expect(readme).toContain('QS 2027');
    expect(readme).toContain('93 所');
    expect(readme).toContain('每天');
    expect(readme).toContain('不依赖付费 API');
  });

  it('explains eligibility, grade-threshold, mixed, and faculty-scoped institution rules', () => {
    for (const phrase of ['院校准入限制', '院校成绩分档', '混合规则', '名单外不一定不能申请', '仅适用于部分学院']) {
      expect(`${methodology}${readme}`).toContain(phrase);
    }
  });

  it('separates annual ranking releases from the reviewed China-rule acceptance path', () => {
    expect(readme).toContain('## 年度排名更新');
    const annualRankingCopy = readme.slice(
      readme.indexOf('## 年度排名更新'),
      readme.indexOf('## 每天来源审查'),
    );
    expect(annualRankingCopy).toContain('人工更新');
    expect(annualRankingCopy).toContain('src/data/rankings.json');
    expect(annualRankingCopy).toContain('docs/data/ranking-sources.md');
    expect(annualRankingCopy).toContain('pnpm test:run');
    expect(annualRankingCopy).toContain('pnpm build');
    expect(annualRankingCopy).not.toContain('pnpm sync:sources');

    const dailyReviewCopy = readme.slice(
      readme.indexOf('## 每天来源审查'),
      readme.indexOf('## 本地运行'),
    );
    expect(dailyReviewCopy).toContain('页面内容变化或访问异常');
    expect(dailyReviewCopy).not.toContain('自动提取');
    expect(dailyReviewCopy).not.toContain('关键规则文字');
    expect(readme).toContain('`pnpm sync:sources` 仅用于人工确认大学官网来源变化后');
  });

  it('documents the minimum safe source and alias contribution path', () => {
    for (const phrase of ['官方来源', '最小测试样本', '解析保护条件', '院校别名', 'pnpm test:run']) {
      expect(contributing).toContain(phrase);
    }
  });
});

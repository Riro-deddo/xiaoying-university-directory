import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '英国大学中国院校规则，一页查清' })).toBeVisible();
});

test('keeps the directory within the viewport and preserves its visual structure', async ({ page }, testInfo) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page).toHaveScreenshot('directory-home.webp', {
    fullPage: false,
    maxDiffPixelRatio: testInfo.project.name === 'mobile-webkit' ? 0.09 : 0.06,
  });
});

test('searches a UK university and a Chinese undergraduate institution from real generated data', async ({ page }) => {
  const search = page.getByRole('searchbox');
  await search.fill('曼彻斯特大学');
  await expect(page.locator('.university-row:visible')).toHaveCount(1);
  await expect(page.locator('.university-row:visible')).toContainText('The University of Manchester');

  await page.getByRole('button', { name: '查中国本科院校' }).click();
  await search.fill('北京大学');
  await expect(page.locator('#institution-result-count')).toContainText('北京大学');
  await expect(page.locator('.evidence-card').first()).toBeVisible();
});

test('expands a source group with a clear, touch-safe disclosure control', async ({ page }) => {
  const row = page.locator('[data-id="university-of-manchester"]');
  await row.scrollIntoViewIfNeeded();
  const details = row.locator('.china-source-bundle');
  const summary = details.locator(':scope > summary');
  const chevron = summary.locator('[data-ui-icon="chevron-down"]');

  await expect(summary).toBeVisible();
  await expect(chevron).toBeVisible();
  const summaryBox = await summary.boundingBox();
  const labelLayout = await summary.locator('.disclosure-summary-label').evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    writingMode: getComputedStyle(element).writingMode,
  }));
  expect(summaryBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(labelLayout.width).toBeGreaterThan(80);
  expect(labelLayout.writingMode).toBe('horizontal-tb');

  const closedTransform = await chevron.evaluate((element) => getComputedStyle(element).transform);
  await summary.click();
  await expect(details).toHaveAttribute('open', '');
  const openTransform = await chevron.evaluate((element) => getComputedStyle(element).transform);

  expect(openTransform).not.toBe(closedTransform);
  await expect(row.locator('.china-source-bundle-list > a')).toHaveCount(3);
  const overflow = await row.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('has no serious or critical automated accessibility violations', async ({ page }) => {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = result.violations.filter(
    ({ impact }) => impact === 'serious' || impact === 'critical',
  );

  expect(blocking).toEqual([]);
});

test('keeps a long university name readable on a narrow phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-webkit');
  const row = page.locator('[data-id="london-metropolitan-university"]');
  await row.scrollIntoViewIfNeeded();
  const layout = await row.evaluate((element) => {
    const heading = element.querySelector('h2');

    if (!(heading instanceof HTMLElement)) {
      throw new Error('Expected the university row to contain a heading');
    }

    const rowBox = element.getBoundingClientRect();
    const headingBox = heading.getBoundingClientRect();

    return {
      headingWidth: headingBox.width,
      headingWritingMode: getComputedStyle(heading).writingMode,
      rowOverflow: element.scrollWidth - element.clientWidth,
      rowRight: rowBox.right,
      viewportWidth: window.innerWidth,
    };
  });

  expect(layout.headingWidth).toBeGreaterThan(120);
  expect(layout.headingWritingMode).toBe('horizontal-tb');
  expect(layout.rowOverflow).toBeLessThanOrEqual(1);
  expect(layout.rowRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
});

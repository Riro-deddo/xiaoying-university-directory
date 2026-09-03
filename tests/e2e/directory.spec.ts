import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '英国大学中国院校规则，一页查清' })).toBeVisible();
});

test('keeps the directory within the viewport and preserves its visual structure', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page).toHaveScreenshot('directory-home.webp', { fullPage: false });
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
  const headingBox = await row.locator('h2').boundingBox();

  expect(headingBox?.width ?? 0).toBeGreaterThan(120);
  await expect(row).toHaveScreenshot('long-university-mobile.webp');
});

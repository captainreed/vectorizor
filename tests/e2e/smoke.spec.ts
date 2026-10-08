import { expect, test } from '@playwright/test';

test('add item, move slider, switch tabs, persist across reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole('button', { name: /add new item/i }).click();
  await page.getByLabel('Name').fill('Alpha');
  const slider = page.getByLabel('XY plane X');
  await slider.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('3');

  await page.getByRole('button', { name: /add new item/i }).click();
  await page.getByLabel('XZ plane Z').fill('-4');

  await page.screenshot({ path: 'test-results/free.png' });
  await page.getByRole('tab', { name: 'Vectors' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/vectors.png' });

  await page.getByRole('tab', { name: /presets/i }).click();
  await page.getByRole('menuitemradio', { name: 'Top (XZ)' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/preset-top.png' });

  await page.getByRole('tab', { name: /isolate/i }).click();
  await page.getByRole('menuitemradio', { name: 'XY plane' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/isolate-xy.png' });

  await page.getByRole('button', { name: 'Edit axis labels' }).click();
  await page.getByLabel('X axis name').fill('Speed');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(400); // allow throttled save

  await page.reload();
  await expect(page.getByText('Alpha')).toBeVisible();
  await expect(page.getByText(/2 items/)).toBeVisible();
  await expect(page.getByRole('tab', { name: /isolate: xy/i })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('region', { name: 'Axis key' }).getByText('Speed')).toBeVisible();

  expect(errors).toEqual([]);
});

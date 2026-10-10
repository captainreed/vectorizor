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

  await page.getByRole('button', { name: /^modes/i }).click();
  const person = page.getByRole('menuitemcheckbox', { name: 'Person' });
  await expect(person).toHaveAttribute('aria-checked', 'false');
  await person.click();
  await expect(person).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/person-isolate-xy.png' });

  await page.getByRole('button', { name: 'Edit axis labels' }).click();
  await page.getByLabel('X axis name').fill('Speed');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(400); // allow throttled save

  await page.reload();
  await expect(page.getByText('Alpha')).toBeVisible();
  await expect(page.getByText(/2 items/)).toBeVisible();
  await expect(page.getByRole('tab', { name: /isolate: xy/i })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('region', { name: 'Axis key' }).getByText('Speed')).toBeVisible();
  await expect(page.getByRole('button', { name: /^modes \(1\)/i })).toBeVisible();

  await page.getByRole('tab', { name: 'Vectors' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/person-vectors.png' });

  await page.getByRole('button', { name: /^modes/i }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Push' }).click();
  await expect(page.getByRole('menuitemcheckbox', { name: 'Push' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Free 3D' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/push-free.png' });
  await page.getByRole('tab', { name: /isolate/i }).click();
  await page.getByRole('menuitemradio', { name: 'XZ plane' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/push-isolate-xz.png' });

  await page.getByRole('button', { name: /^modes/i }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Single' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Push' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('XYZ(3, 0, 0)')).toBeVisible();
  await page.getByRole('tab', { name: 'Vectors' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/single-vectors.png' });

  // Compass: diagonal axes + 45° planes, with one slider per diagonal.
  await page.getByRole('button', { name: /^modes/i }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Single' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Compass' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Alpha — expand/ }).click();
  await page.getByLabel('Diagonal NE').fill('3');
  await page.getByLabel('Diagonal Up-NW').fill('4');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/compass-vectors.png' });

  await page.getByRole('button', { name: /^modes/i }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Push' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Free 3D' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/compass-push.png' });

  await page.getByRole('tab', { name: /isolate/i }).click();
  await page.getByRole('menuitemradio', { name: 'NE–Y plane' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/compass-isolate-ne-y.png' });

  await page.getByRole('button', { name: /^modes/i }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Single' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Free 3D' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/compass-single.png' });

  await page.waitForTimeout(400); // allow throttled save
  await page.reload();
  await expect(page.getByText('Diag(3, 0, 0, 4)')).toBeVisible();

  expect(errors).toEqual([]);
});

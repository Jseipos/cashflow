import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE = 'http://localhost:3000';

test('CSV import does not crash', async ({ page }) => {
  // Create a test CSV file
  const csvContent = `Date,Description,Type,Amount,Account,Category,Recurrence
2026-08-01,Rent,expense,1500.00,Checking,Housing/Rent,monthly
2026-08-05,Groceries,expense,150.00,Checking,Groceries,once
2026-08-08,Paycheck,income,3000.00,Checking,Income,biweekly`;
  
  const csvPath = path.join('/tmp', 'test-import.csv');
  fs.writeFileSync(csvPath, csvContent);

  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(`${BASE}/calendar`);
  await page.waitForLoadState('networkidle');

  // Open settings
  const settingsBtn = page.locator('button[aria-label="Settings"], button:has-text("⚙")');
  await expect(settingsBtn.first()).toBeVisible();
  await settingsBtn.first().click();
  await page.waitForTimeout(500);

  // Find the import button and trigger file chooser
  const importBtn = page.locator('button:has-text("Restore from JSON Backup")');
  await expect(importBtn).toBeVisible();

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    importBtn.click(),
  ]);
  await fileChooser.setFiles(csvPath);

  // Wait to see if it crashes or succeeds
  await page.waitForTimeout(3000);

  // Check if page is still alive
  const body = await page.locator('body').textContent();
  const pageAlive = body!.length > 50;
  
  console.log('Page alive after import:', pageAlive);
  console.log('JS errors:', errors);
  console.log('Body snippet:', body!.substring(0, 300));

  // Check for success or error messages
  const successMsg = page.locator('text=Imported');
  const errorMsg = page.locator('text=failed');
  
  if (await successMsg.isVisible()) {
    console.log('SUCCESS:', await successMsg.textContent());
  }
  if (await errorMsg.isVisible()) {
    console.log('ERROR MSG:', await errorMsg.textContent());
  }

  expect(pageAlive).toBe(true);
});

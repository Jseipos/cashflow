import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test('Paste CSV import does not crash on submit', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(`${BASE}/calendar`);
  await page.waitForLoadState('networkidle');

  // Open settings
  const settingsBtn = page.locator('button[aria-label="Settings"], button:has-text("⚙")');
  await settingsBtn.first().click();
  await page.waitForTimeout(500);

  // Click paste CSV button
  const pasteBtn = page.locator('button:has-text("Paste CSV Data")');
  await expect(pasteBtn).toBeVisible();
  await pasteBtn.click();
  await page.waitForTimeout(300);

  // Paste data into textarea
  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible();
  await textarea.fill(`Date,Description,Type,Amount,Account,Category,Recurrence
2026-08-01,Rent,expense,1500.00,Checking,Housing/Rent,monthly
2026-08-05,Groceries,expense,150.00,Checking,Groceries,once
2026-08-08,Paycheck,income,3000.00,Checking,Income,biweekly`);

  // Click Preview
  const previewBtn = page.locator('button:has-text("Preview")');
  await previewBtn.click();
  await page.waitForTimeout(500);

  // Check preview rendered
  const previewText = await page.locator('body').textContent();
  console.log('Preview visible:', previewText!.includes('rows ready'));
  console.log('Has biweekly:', previewText!.includes('biweekly'));

  // Click Import
  const importBtn = page.locator('button:has-text("Import")');
  const importBtnCount = await importBtn.count();
  console.log('Import buttons found:', importBtnCount);
  
  // Find the actual import submit button (not "Paste CSV Data to Add Items")
  const submitBtn = page.locator('button:has-text("Import 3 Items")');
  await expect(submitBtn).toBeVisible();
  await submitBtn.click();
  
  // Wait and check if page crashed
  await page.waitForTimeout(3000);
  
  const bodyAfter = await page.locator('body').textContent();
  const pageAlive = bodyAfter!.length > 50;
  console.log('Page alive after import:', pageAlive);
  console.log('JS errors:', errors);
  console.log('Body snippet:', bodyAfter!.substring(0, 300));

  // Check for success message
  if (bodyAfter!.includes('Imported') || bodyAfter!.includes('imported')) {
    console.log('SUCCESS message found');
  }
  if (bodyAfter!.includes('failed') || bodyAfter!.includes('error')) {
    console.log('ERROR message found');
  }

  expect(pageAlive).toBe(true);
  expect(errors).toHaveLength(0);
});

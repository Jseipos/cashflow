import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('Cashflow App - Phase 3+4', () => {
  test('Calendar page loads with tab bar', async ({ page }) => {
    await page.goto(`${BASE}/calendar`);
    await page.waitForLoadState('networkidle');
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    // Should have 5 tabs now (Calendar, Scan, Cards, Payoff, Wishlist)
    const tabs = nav.locator('a');
    const count = await tabs.count();
    console.log(`Tab count: ${count}`);
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('Cards page loads', async ({ page }) => {
    await page.goto(`${BASE}/cards`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Credit Cards');
  });

  test('Payoff page loads', async ({ page }) => {
    await page.goto(`${BASE}/payoff`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Payoff');
  });

  test('Wishlist page loads', async ({ page }) => {
    await page.goto(`${BASE}/wishlist`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Wish List');
  });

  test('Scan page loads', async ({ page }) => {
    await page.goto(`${BASE}/scan`);
    await page.waitForLoadState('networkidle');
    // Should have some content - camera or upload UI
    const body = await page.locator('body').textContent();
    expect(body!.length).toBeGreaterThan(50);
  });

  test('Tab navigation works', async ({ page }) => {
    await page.goto(`${BASE}/calendar`);
    await page.waitForLoadState('networkidle');
    
    // Navigate to Cards
    await page.click('nav a:has-text("Cards")');
    await page.waitForURL('**/cards');
    await expect(page.locator('h1')).toContainText('Credit Cards');
    
    // Navigate to Payoff
    await page.click('nav a:has-text("Payoff")');
    await page.waitForURL('**/payoff');
    
    // Navigate to Wishlist
    await page.click('nav a:has-text("Wishlist")');
    await page.waitForURL('**/wishlist');
    
    // Navigate back to Calendar
    await page.click('nav a:has-text("Calendar")');
    await page.waitForURL('**/calendar');
  });

  test('No JS errors on any page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    
    for (const route of ['/calendar', '/cards', '/payoff', '/wishlist', '/scan']) {
      await page.goto(`${BASE}${route}`);
      await page.waitForLoadState('networkidle');
    }
    
    if (errors.length > 0) {
      console.log('JS Errors:', errors);
    }
    expect(errors).toHaveLength(0);
  });

  test('Add Card flow works', async ({ page }) => {
    await page.goto(`${BASE}/cards`);
    await page.waitForLoadState('networkidle');
    
    // Click Add Card button
    const addBtn = page.locator('button:has-text("Add")');
    await expect(addBtn.first()).toBeVisible();
    await addBtn.first().click();
    
    // Form should appear
    const form = page.locator('form');
    await expect(form).toBeVisible();
    
    // Fill out the form
    await page.fill('input[placeholder*="Chase"]', 'Test Card');
    await page.fill('input[placeholder="0.00"] >> nth=0', '5000');
    await page.fill('input[placeholder="0.00"] >> nth=1', '15000');
    await page.fill('input[placeholder="24.99"]', '22.99');
    await page.fill('input[placeholder="0.00"] >> nth=2', '150');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Should show the card in the list
    await page.waitForTimeout(1000);
    const body = await page.locator('body').textContent();
    expect(body).toContain('Test Card');
  });

  test('Add Wishlist item flow works', async ({ page }) => {
    await page.goto(`${BASE}/wishlist`);
    await page.waitForLoadState('networkidle');
    
    // Click Add button
    const addBtn = page.locator('button:has-text("Add")');
    await expect(addBtn.first()).toBeVisible();
    await addBtn.first().click();
    
    // Form should appear
    const form = page.locator('form');
    await expect(form).toBeVisible();
    
    // Fill out
    await page.fill('input[placeholder*="laptop"]', 'Test Item');
    await page.fill('input[placeholder="0.00"] >> nth=0', '1200');
    await page.fill('input[placeholder="0.00"] >> nth=1', '200');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Should show the item
    await page.waitForTimeout(1000);
    const body = await page.locator('body').textContent();
    expect(body).toContain('Test Item');
  });
});

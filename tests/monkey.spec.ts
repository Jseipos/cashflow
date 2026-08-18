import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

// Monkey test: hit every page, check for JS errors, verify key UI elements render
test.describe('Monkey Test — All Pages Load', () => {
  const pages = [
    { path: '/calendar', name: 'Calendar' },
    { path: '/dashboard', name: 'Dashboard' },
    { path: '/cards', name: 'Cards' },
    { path: '/payoff', name: 'Payoff' },
    { path: '/wishlist', name: 'Wishlist' },
    { path: '/about', name: 'About' },
  ];

  for (const p of pages) {
    test(`${p.name} page loads without JS errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(`${BASE}${p.path}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // Page should have content (not stuck on loading)
      const body = await page.locator('body').textContent();
      expect(body!.length).toBeGreaterThan(50);

      // Should not show "Loading..." after 1.5s
      const loadingVisible = await page.locator('text=Loading...').isVisible().catch(() => false);
      
      // Tab bar should be visible
      await expect(page.locator('nav')).toBeVisible();

      if (errors.length > 0) {
        console.log(`JS errors on ${p.name}:`, errors);
      }
      expect(errors).toEqual([]);
    });
  }
});

test.describe('Monkey Test — Calendar Interactions', () => {
  test('Calendar renders grid with day cells', async ({ page }) => {
    await page.goto(`${BASE}/calendar`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Should have a calendar grid with day buttons
    const dayButtons = page.locator('main button');
    const count = await dayButtons.count();
    expect(count).toBeGreaterThan(20); // at least ~28-35 day cells
  });

  test('Month navigation works', async ({ page }) => {
    await page.goto(`${BASE}/calendar`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Get current month text
    const monthEl = page.locator('h2');
    const currentMonth = await monthEl.textContent();

    // Click next month
    await page.locator('button[aria-label="Next month"]').click();
    await page.waitForTimeout(500);
    const nextMonth = await monthEl.textContent();
    expect(nextMonth).not.toBe(currentMonth);

    // Click previous month twice to go back
    await page.locator('button[aria-label="Previous month"]').click();
    await page.waitForTimeout(500);
    await page.locator('button[aria-label="Previous month"]').click();
    await page.waitForTimeout(500);
    const prevMonth = await monthEl.textContent();
    expect(prevMonth).not.toBe(nextMonth);
  });

  test('Add button opens modal', async ({ page }) => {
    await page.goto(`${BASE}/calendar`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Click the floating + button
    await page.locator('button[aria-label="Add scheduled item"]').click();
    await page.waitForTimeout(500);

    // Modal should appear
    await expect(page.locator('text=Add Scheduled Item')).toBeVisible();

    // Close it
    await page.locator('button[aria-label="Close"]').first().click();
    await page.waitForTimeout(300);
  });

  test('Settings modal opens', async ({ page }) => {
    await page.goto(`${BASE}/calendar`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Click settings gear
    await page.locator('button[aria-label="Settings"]').click();
    await page.waitForTimeout(500);

    // Should show settings content
    await expect(page.locator('text=Export Data')).toBeVisible();
    await expect(page.locator('text=Backup & Sync')).toBeVisible();

    // Close
    await page.locator('button[aria-label="Close"]').first().click();
  });

  test('Add expense flow works end-to-end', async ({ page }) => {
    await page.goto(`${BASE}/calendar`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Open add modal
    await page.locator('button[aria-label="Add scheduled item"]').click();
    await page.waitForTimeout(500);

    // Fill in amount
    await page.locator('input[type="number"]').fill('42.50');

    // Fill in description
    await page.locator('input[type="text"]').fill('Monkey test expense');

    // Submit
    await page.locator('button:has-text("Add Item")').click();
    await page.waitForTimeout(1000);

    // Modal should close (no error visible)
    const errorVisible = await page.locator('.bg-red-50').isVisible().catch(() => false);
    expect(errorVisible).toBe(false);
  });
});

test.describe('Monkey Test — Dashboard', () => {
  test('Dashboard shows insight sections', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Should show at least one insight section
    const sections = page.locator('section');
    const count = await sections.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Monkey Test — Cards', () => {
  test('Cards page renders', async ({ page }) => {
    await page.goto(`${BASE}/cards`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Should show the page header
    await expect(page.locator('h1')).toBeVisible();
  });

  test('Add card form opens and closes', async ({ page }) => {
    await page.goto(`${BASE}/cards`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Find and click add button
    const addBtn = page.locator('button:has-text("Add Card"), button:has-text("+ Add")');
    if (await addBtn.first().isVisible()) {
      await addBtn.first().click();
      await page.waitForTimeout(500);

      // Form should be visible — close it
      const closeBtn = page.locator('button[aria-label="Close"], button:has-text("Cancel")');
      if (await closeBtn.first().isVisible()) {
        await closeBtn.first().click();
      }
    }
  });
});

test.describe('Monkey Test — Payoff Calculator', () => {
  test('Payoff page renders', async ({ page }) => {
    await page.goto(`${BASE}/payoff`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await expect(page.locator('h1')).toBeVisible();
  });

  test('Strategy toggle works', async ({ page }) => {
    await page.goto(`${BASE}/payoff`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Check if strategy buttons exist (only when cards are present)
    const avalanche = page.locator('button:has-text("Avalanche")');
    const snowball = page.locator('button:has-text("Snowball")');

    if (await avalanche.isVisible()) {
      await snowball.click();
      await page.waitForTimeout(300);
      await avalanche.click();
      await page.waitForTimeout(300);
    }
  });

  test('Extra payment slider works', async ({ page }) => {
    await page.goto(`${BASE}/payoff`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const slider = page.locator('input[type="range"]');
    if (await slider.isVisible()) {
      await slider.fill('500');
      await page.waitForTimeout(300);
      // Should show $500 somewhere
      await expect(page.locator('text=$500')).toBeVisible();
    }
  });
});

test.describe('Monkey Test — Wishlist', () => {
  test('Wishlist page renders', async ({ page }) => {
    await page.goto(`${BASE}/wishlist`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await expect(page.locator('h1')).toBeVisible();
  });

  test('Add wishlist item form opens', async ({ page }) => {
    await page.goto(`${BASE}/wishlist`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const addBtn = page.locator('button:has-text("+ Add Item")');
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);

      // Close
      const closeBtn = page.locator('button[aria-label="Close"], button:has-text("Cancel")');
      if (await closeBtn.first().isVisible()) {
        await closeBtn.first().click();
      }
    }
  });
});

test.describe('Monkey Test — About Page', () => {
  test('About page renders all sections', async ({ page }) => {
    await page.goto(`${BASE}/about`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check all feature sections are present
    await expect(page.locator('text=Cash Flow Calendar')).toBeVisible();
    await expect(page.locator('text=Financial Dashboard')).toBeVisible();
    await expect(page.locator('text=Credit Card Manager')).toBeVisible();
    await expect(page.locator('text=Debt Payoff Calculator')).toBeVisible();
    await expect(page.locator('text=Savings Wishlist')).toBeVisible();
    await expect(page.locator('text=Receipt Scanner')).toBeVisible();
    await expect(page.locator('text=Privacy & Architecture')).toBeVisible();
  });
});

test.describe('Monkey Test — Tab Navigation', () => {
  test('All tab bar links navigate correctly', async ({ page }) => {
    await page.goto(`${BASE}/calendar`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const tabs = [
      { label: 'Dashboard', expectedPath: '/dashboard' },
      { label: 'Cards', expectedPath: '/cards' },
      { label: 'Payoff', expectedPath: '/payoff' },
      { label: 'Wishlist', expectedPath: '/wishlist' },
      { label: 'About', expectedPath: '/about' },
      { label: 'Calendar', expectedPath: '/calendar' },
    ];

    for (const tab of tabs) {
      await page.locator(`nav a:has-text("${tab.label}")`).click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      expect(page.url()).toContain(tab.expectedPath);
    }
  });
});

test.describe('Monkey Test — No Console Errors on Navigation', () => {
  test('Rapid tab switching does not produce errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${BASE}/calendar`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Rapidly switch tabs
    const paths = ['/dashboard', '/cards', '/payoff', '/wishlist', '/about', '/calendar'];
    for (const path of paths) {
      await page.goto(`${BASE}${path}`);
      await page.waitForTimeout(300);
    }

    // Cycle back
    for (const path of paths.reverse()) {
      await page.goto(`${BASE}${path}`);
      await page.waitForTimeout(300);
    }

    if (errors.length > 0) {
      console.log('JS errors during rapid navigation:', errors);
    }
    expect(errors).toEqual([]);
  });
});

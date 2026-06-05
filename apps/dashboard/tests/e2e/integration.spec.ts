import { test, expect } from '@playwright/test';

test.describe('Dashboard System Integration Flow Tests', () => {
  test('operator_twin_pause_propagates_to_observer', async ({ browser }) => {
    test.setTimeout(120000);

    const context = await browser.newContext();

    const operatorPage = await context.newPage();
    const observerPage = await context.newPage();

    // Prevent Recharts height/width warnings from flooding log stream and choking resources
    const silenceWarnings = () => {
      const originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('width(0) and height(0)')) {
          return;
        }
        originalWarn(...args);
      };
    };
    await operatorPage.addInitScript(silenceWarnings);
    await observerPage.addInitScript(silenceWarnings);

    operatorPage.on('console', msg => {
      if (msg.text().includes('width(0) and height(0)')) return;
      console.log(`[Operator Browser] ${msg.text()}`);
    });
    observerPage.on('console', msg => {
      if (msg.text().includes('width(0) and height(0)')) return;
      console.log(`[Observer Browser] ${msg.text()}`);
    });

    // 1. Load operator dashboard
    await operatorPage.goto('/twin');
    await expect(operatorPage.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });

    // 2. Open sharing modal and start session
    const shareBtn = operatorPage.locator('button:has-text("SHARE LIVE")');
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();
    await operatorPage.waitForTimeout(500); // Allow modal animation to finish

    const generateBtn = operatorPage.locator('button:has-text("GENERATE LIVE SHARE LINK")');
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    const shareInput = operatorPage.locator('input[readonly]');
    await expect(shareInput).toBeVisible({ timeout: 30000 });
    const shareUrl = await shareInput.inputValue();

    // Close the sharing modal so it doesn't block the rest of Operator UI pointer events
    const closeBtn = operatorPage.locator('button:has(svg.lucide-x)');
    await closeBtn.click();
    await expect(closeBtn).not.toBeVisible();

    // 3. Load observer dashboard
    await observerPage.goto(shareUrl);
    
    // Ensure observer is connected and observing
    const banner = observerPage.locator('text=OBSERVING LIVE');
    await expect(banner).toBeVisible({ timeout: 60000 });

    // Wait for the WebRTC connection or WS fallback relay to be active
    const statusText = observerPage.locator('[data-testid="observer-status-text"]');
    await expect(statusText).toHaveText(/(RTC LIVE STREAM|Relayed)/, { timeout: 15000 });

    // Ensure paused overlay is not showing initially
    const pausedOverlay = observerPage.locator('#paused-overlay');
    await expect(pausedOverlay).not.toBeVisible();

    // 4. Click freeze/pause button on operator page
    const freezeBtn = operatorPage.locator('#twin-freeze-btn');
    await expect(freezeBtn).toBeVisible();
    await freezeBtn.click();

    // 5. Verify paused overlay appears on observer twin canvas within 20 seconds
    await expect(pausedOverlay).toBeVisible({ timeout: 20000 });
  });

  test('langchain_parse_failure_shows_error_card', async ({ page }) => {
    test.setTimeout(60000);

    // Mock the /api/command endpoint to return 500
    await page.route('**/api/command', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
        },
        body: JSON.stringify({ detail: 'LangChain parsing failed: Internal Server Error' }),
      });
    });

    await page.goto('/command');
    await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });

    const input = page.locator('input[placeholder*="Enter natural language command"]');
    await expect(input).toBeVisible();
    await input.fill('move to home');

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Verify error card renders
    const errorCard = page.locator('.error-card');
    await expect(errorCard).toBeVisible({ timeout: 15000 });

    // Verify "Try again" button is visible inside error card
    const tryAgainBtn = page.locator('.try-again-btn');
    await expect(tryAgainBtn).toBeVisible({ timeout: 15000 });
  });
});
